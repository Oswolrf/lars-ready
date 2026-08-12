"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { spawn } = require("node:child_process");
const chromeLauncher = require("chrome-launcher");

const root = path.resolve(__dirname, "..");
const reportDirectory = path.join(root, ".lighthouseci");
const quick = process.argv.includes("--quick");
const routeArgument = process.argv.find((argument) => argument.startsWith("--route="))?.slice("--route=".length);
const profileArgument = process.argv.find((argument) => argument.startsWith("--profile="))?.slice("--profile=".length);
const routes = routeArgument
  ? [`/${routeArgument.replace(/^\/+|\/+$/g, "")}/`.replace(/^\/\/$/, "/")]
  : quick
    ? ["/"]
    : ["/", "/la-casona/", "/suite-la-panera/", "/villa-el-camino/", "/el-entorno/", "/rural-prado/"];
const profiles = profileArgument ? [profileArgument] : quick ? ["mobile"] : ["mobile", "desktop"];
const failures = [];

if (profiles.some((profile) => !["mobile", "desktop"].includes(profile))) {
  throw new Error("--profile debe ser mobile o desktop");
}

function waitForServer(url, attempts = 60) {
  return new Promise((resolve, reject) => {
    const check = async () => {
      try {
        const response = await fetch(url);
        if (response.ok) return resolve();
      } catch (_error) {
        // El servidor todavía no está preparado.
      }
      if (attempts-- <= 0) return reject(new Error("El servidor local no respondió"));
      setTimeout(check, 250);
    };
    check();
  });
}

async function main() {
  if (!fs.existsSync(path.join(root, "public", "build-manifest.json"))) {
    throw new Error("Ejecuta npm run build antes de Lighthouse");
  }
  fs.mkdirSync(reportDirectory, { recursive: true });
  const server = spawn(process.execPath, [path.join(root, "scripts", "serve_static.js"), "public", "--port=4174"], {
    cwd: root,
    stdio: ["ignore", "pipe", "inherit"],
  });
  try {
    await waitForServer("http://127.0.0.1:4174/");
    const chrome = await chromeLauncher.launch({ chromeFlags: ["--headless", "--no-sandbox", "--disable-gpu"] });
    try {
      const { default: lighthouse } = await import("lighthouse");
      const { default: desktopConfig } = await import("lighthouse/core/config/desktop-config.js");
      for (const profile of profiles) {
        for (const route of routes) {
          const url = `http://127.0.0.1:4174${route}`;
          const desktop = profile === "desktop";
          const result = await lighthouse(url, {
            port: chrome.port,
            output: "json",
            logLevel: "error",
            formFactor: desktop ? "desktop" : "mobile",
            screenEmulation: desktop
              ? { mobile: false, width: 1350, height: 940, deviceScaleFactor: 1, disabled: false }
              : undefined,
            throttlingMethod: "simulate",
          }, desktop ? desktopConfig : undefined);
          const lhr = result.lhr;
          const slug = route === "/" ? "inicio" : route.replaceAll("/", "");
          fs.writeFileSync(path.join(reportDirectory, `${slug}-${profile}.json`), result.report);
          const metrics = {
            performance: lhr.categories.performance.score,
            lcp: lhr.audits["largest-contentful-paint"].numericValue,
            cls: lhr.audits["cumulative-layout-shift"].numericValue,
            tbt: lhr.audits["total-blocking-time"].numericValue,
          };
          console.log(`${profile} ${route}: performance ${Math.round(metrics.performance * 100)}, LCP ${Math.round(metrics.lcp)} ms, CLS ${metrics.cls.toFixed(3)}, TBT ${Math.round(metrics.tbt)} ms`);
          if (metrics.performance < 0.9) failures.push(`${profile} ${route}: Performance < 90`);
          if (metrics.lcp > 2500) failures.push(`${profile} ${route}: LCP > 2500 ms`);
          if (metrics.cls > 0.1) failures.push(`${profile} ${route}: CLS > 0.1`);
          if (metrics.tbt > 200) failures.push(`${profile} ${route}: TBT > 200 ms`);
        }
      }
    } finally {
      try {
        await chrome.kill();
      } catch (error) {
        if (error?.code !== "EPERM") throw error;
        console.warn(`Chrome terminó, pero Windows mantuvo bloqueado su directorio temporal: ${error.path || "desconocido"}`);
      }
    }
  } finally {
    server.kill();
  }
  if (failures.length) throw new Error(`Presupuestos Lighthouse incumplidos:\n${failures.join("\n")}`);
}

main().catch((error) => {
  console.error(error.stack || error.message || error);
  process.exitCode = 1;
});
