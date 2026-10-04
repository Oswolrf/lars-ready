"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { once } = require("node:events");
const { test } = require("node:test");
const { chromium } = require("@playwright/test");
const { buildMaintenance } = require("../../scripts/build_maintenance.cjs");
const { buildScheduledLaunch } = require("../../scripts/build_launch.cjs");
const { createStaticServer } = require("../../scripts/serve_static.js");
const { validateLaunch } = require("../../scripts/validate_launch.cjs");
const { resolveLaunchConfig } = require("../../scripts/launch_config.cjs");
const root = path.resolve(__dirname, "../..");
const cache = path.join(root, "node_modules/.cache/launch-tests");

function browserOptions() {
  const localBrowsers = path.join(process.env.USERPROFILE || "", "AppData/Local/ms-playwright");
  const shells = fs.existsSync(localBrowsers) ? fs.readdirSync(localBrowsers)
    .filter((name) => /^chromium_headless_shell-\d+$/.test(name))
    .sort((a, b) => Number(b.split("-").pop()) - Number(a.split("-").pop()))
    .map((name) => path.join(localBrowsers, name, "chrome-headless-shell-win64/chrome-headless-shell.exe")) : [];
  const candidates = [process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE, chromium.executablePath(),
    ...shells,
    "C:/Program Files/Google/Chrome/Application/chrome.exe"];
  const executablePath = candidates.find((file) => file && fs.existsSync(file));
  return { headless: true, ...(executablePath ? { executablePath } : {}) };
}

async function fixture(basePath = "/", scheduled = true) {
  fs.mkdirSync(cache, { recursive: true });
  const output = fs.mkdtempSync(path.join(cache, "build-"));
  const deadline = Date.parse("2030-07-15T08:00:00Z");
  let clock = deadline - 90061000;
  const launch = resolveLaunchConfig({ site: { launchAt: "2030-07-15T10:00:00+02:00", launchServerTimeZone: "UTC" }, maintenance: true, env: {}, now: clock });
  if (scheduled) {
    const manifest = { basePath, launch, pages: [] };
    fs.writeFileSync(path.join(output, "build-manifest.json"), JSON.stringify(manifest));
    fs.writeFileSync(path.join(output, ".htaccess"), require("../../scripts/build_launch.cjs").apacheLaunchRules({ launch, basePath }) + `<If "%{TIME} >= '${launch.apacheTime}'">\n</If>\n` + require("../../scripts/build_launch.cjs").apacheLaunchHeaders({ launch, basePath }));
    buildScheduledLaunch({ root, output, basePath, deployEnv: "production", siteOrigin: "https://lardevies.com", launch });
    const built = JSON.parse(fs.readFileSync(path.join(output, "build-manifest.json")));
    for (const { route, locale } of built.launch.cover.pages) {
      const target = path.join(output, route.slice(1), "index.html");
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.writeFileSync(target, `<!doctype html><html lang="${locale}"><head><meta charset="utf-8"><meta name="robots" content="index,follow"><title>Web abierta</title></head><body><nav>Web completa</nav><main>Web abierta: ${route}</main></body></html>`);
    }
    fs.writeFileSync(path.join(output, "sitemap.xml"), "<urlset><url><loc>https://lardevies.com/</loc></url></urlset>");
    fs.writeFileSync(path.join(output, "robots.txt"), "User-agent: *\nAllow: /\nSitemap: https://lardevies.com/sitemap.xml\n");
    fs.writeFileSync(path.join(output, "404.html"), "<!doctype html><html lang=\"es\"><head><title>404</title></head><body>Página no encontrada</body></html>");
    fs.writeFileSync(path.join(output, "410.html"), "<!doctype html><html lang=\"es\"><head><title>410</title></head><body>Página retirada</body></html>");
  } else buildMaintenance({ root, output, basePath, deployEnv: "production", siteOrigin: "https://lardevies.com" });
  if (basePath !== "/") {
    const mounted = path.join(output, basePath.slice(1));
    fs.mkdirSync(mounted, { recursive: true });
    for (const name of fs.readdirSync(output)) {
      if (["build-manifest.json", ".htaccess", basePath.split("/")[1]].includes(name)) continue;
      fs.renameSync(path.join(output, name), path.join(mounted, name));
    }
  }
  if (scheduled) validateLaunch(output, JSON.parse(fs.readFileSync(path.join(output, "build-manifest.json"))));
  const server = createStaticServer(output, { now: () => clock });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  return {
    origin: `http://127.0.0.1:${server.address().port}`,
    deadline, setTime(value) { clock = value; },
    async close() {
      await new Promise((resolve) => server.close(resolve));
      const resolved = path.resolve(output);
      assert.equal(path.dirname(resolved), path.resolve(cache));
      assert.ok(path.basename(resolved).startsWith("build-"));
      fs.rmSync(resolved, { recursive: true, force: true });
    },
  };
}

test("sin fecha no hay contador ficticio ni scripts y las reservas siguen funcionando", async () => {
  const site = await fixture("/", false);
  let browser;
  try {
    browser = await chromium.launch({ ...browserOptions(), timeout: 15000 });
    const page = await browser.newPage();
    await page.goto(site.origin);
    assert.equal(await page.locator("[data-countdown], script").count(), 0);
    await page.locator("summary").click();
    assert.equal(await page.locator("details[open] a").count(), 2);
  } finally { await browser?.close(); await site.close(); }
});

for (const basePath of ["/", "/preview/"]) test(`antes y después del lanzamiento, sin JavaScript, con idiomas y SEO (${basePath})`, async () => {
  const site = await fixture(basePath);
  let browser;
  try {
    browser = await chromium.launch({ ...browserOptions(), timeout: 15000 });
    const context = await browser.newContext({ javaScriptEnabled: false, reducedMotion: "reduce" });
    for (const locale of ["", "en/", "de/"]) {
      const page = await context.newPage();
      await page.goto(`${site.origin}${basePath}${locale}`);
      assert.equal(await page.locator("nav").count(), 0);
      assert.equal(await page.locator(".countdown-units").isHidden(), true);
      assert.ok(await page.locator("time").textContent());
      await page.locator("summary").click({ timeout: 5000 });
      assert.equal(await page.locator("details[open] a").count(), 2);
      await page.close();
    }
    assert.deepEqual(await (await fetch(`${site.origin}${basePath}__launch/status.json`)).json(), { launched: false });
    assert.ok(!(await (await fetch(`${site.origin}${basePath}sitemap.xml`)).text()).includes("<loc>"));
    for (const route of ["LaCasona.html", "blog/", "inexistente/", "la-casona/index.html"]) {
      const response = await fetch(`${site.origin}${basePath}${route}`, { redirect: "manual" });
      assert.equal(response.status, 200);
      assert.match(await response.text(), /data-countdown/);
      assert.equal(response.headers.get("cache-control"), "no-store");
    }
    site.setTime(site.deadline);
    const page = await context.newPage();
    await page.goto(`${site.origin}${basePath}en/la-casona/`);
    assert.equal(await page.locator("nav").textContent(), "Web completa");
    assert.equal(await page.locator("[data-countdown]").count(), 0);
    assert.equal(await page.locator("meta[name=robots]").getAttribute("content"), "index,follow");
    assert.deepEqual(await (await fetch(`${site.origin}${basePath}__launch/status.json`)).json(), { launched: true });
    assert.match(await (await fetch(`${site.origin}${basePath}sitemap.xml`)).text(), /<loc>/);
    const redirect = await fetch(`${site.origin}${basePath}LaCasona.html`, { redirect: "manual" });
    assert.equal(redirect.status, 301);
    assert.equal(redirect.headers.get("location"), `${basePath}la-casona/`);
    assert.equal((await fetch(`${site.origin}${basePath}blog/`)).status, 410);
    assert.equal((await fetch(`${site.origin}${basePath}inexistente/`)).status, 404);
  } finally { await browser?.close(); await site.close(); }
});

test("la pestaña abierta usa la hora del servidor y pasa a la misma página sin adelantar la apertura", async () => {
  const site = await fixture();
  let browser;
  try {
    browser = await chromium.launch({ ...browserOptions(), timeout: 15000 });
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    await page.addInitScript(() => { Date.now = () => Date.parse("2040-01-01T00:00:00Z"); });
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto(`${site.origin}/en/la-casona/?campaign=launch#details`);
    await page.waitForFunction(() => document.querySelector("[data-countdown-days]").textContent === "01");
    assert.equal(await page.locator("[data-countdown-hours]").textContent(), "01");
    assert.equal(await page.locator("nav").count(), 0);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true);
    await page.screenshot({ path: path.join(cache, "countdown-mobile.png"), fullPage: true });
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.screenshot({ path: path.join(cache, "countdown-desktop.png"), fullPage: true });
    await page.locator("summary").click();
    assert.equal(await page.locator("details[open] a").count(), 2);
    site.setTime(site.deadline - 2000);
    await page.evaluate(() => window.dispatchEvent(new Event("online")));
    await page.waitForFunction(() => document.querySelector("[data-countdown-days]").textContent === "00");
    assert.equal(await page.locator("nav").count(), 0);
    site.setTime(site.deadline);
    await page.waitForSelector("nav", { timeout: 10000 });
    assert.equal(new URL(page.url()).pathname, "/en/la-casona/");
    assert.equal(new URL(page.url()).search, "?campaign=launch");
    assert.equal(new URL(page.url()).hash, "#details");
    assert.deepEqual(errors, []);
  } finally { await browser?.close(); await site.close(); }
});

test("si falla la comprobación al llegar a cero no hay bucle de recargas; vuelve a abrir al recuperar conexión", async () => {
  const site = await fixture();
  let browser;
  try {
    browser = await chromium.launch({ ...browserOptions(), timeout: 15000 });
    const page = await browser.newPage();
    await page.goto(site.origin);
    await page.waitForFunction(() => document.querySelector("[data-countdown-days]").textContent === "01");
    site.setTime(site.deadline - 1000);
    await page.evaluate(() => window.dispatchEvent(new Event("online")));
    await page.waitForFunction(() => document.querySelector("[data-countdown-days]").textContent === "00");
    await page.route("**/__launch/status.json", (route) => route.abort());
    site.setTime(site.deadline);
    await page.waitForFunction(() => document.querySelector(".launch-status").textContent.includes("Abriendo"));
    assert.equal(await page.locator("[data-countdown-seconds]").textContent(), "00");
    assert.equal(await page.locator("nav").count(), 0);
    await page.locator("summary").click();
    assert.equal(await page.locator("details[open] a").count(), 2);
    await page.unroute("**/__launch/status.json");
    await page.evaluate(() => window.dispatchEvent(new Event("online")));
    await page.waitForSelector("nav");
  } finally { await browser?.close(); await site.close(); }
});
