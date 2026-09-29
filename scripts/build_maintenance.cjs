"use strict";
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const nunjucks = require("nunjucks");
const config = require("../site.config.cjs");
const i18n = require("../i18n.config.cjs");

const copy = {
  es: { title: "El comienzo de algo nuevo", reserve: "Reservar", choose: "Elige tu alojamiento", lar: "Suites y villas en A Pontenova", prado: "Alojamientos en San Tirso de Abres" },
  en: { title: "The beginning of something new", reserve: "Book your stay", choose: "Choose your accommodation", lar: "Suites and villas in A Pontenova", prado: "Accommodation in San Tirso de Abres" },
  de: { title: "Der Anfang von etwas Neuem", reserve: "Jetzt buchen", choose: "Wählen Sie Ihre Unterkunft", lar: "Suiten und Villen in A Pontenova", prado: "Unterkünfte in San Tirso de Abres" },
};

function buildMaintenance({ root, output, basePath, deployEnv, siteOrigin }) {
  const write = (relative, value) => {
    const target = path.join(output, relative);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, value);
  };
  const asset = (name, data) => {
    const hash = crypto.createHash("sha256").update(data).digest("hex").slice(0, 12);
    const relative = `assets/maintenance/${path.parse(name).name}-${hash}${path.extname(name)}`;
    write(relative, data);
    return `${basePath}${relative}`;
  };
  const logoData = fs.readFileSync(path.join(root, "images/logo solo blanco.png"));
  const logo = asset("logo.png", logoData);
  const font = asset("lora.woff2", fs.readFileSync(path.join(root, "node_modules/@fontsource/lora/files/lora-latin-400-normal.woff2")));
  const css = asset("maintenance.css", fs.readFileSync(path.join(root, "src/maintenance.css"), "utf8").replace("./lora.woff2", font));
  write("favicon.ico", fs.readFileSync(path.join(root, "favicon.ico")));
  const templates = new nunjucks.Environment(new nunjucks.FileSystemLoader(path.join(root, "src/templates")), { autoescape: true, throwOnUndefined: true });
  const pages = [];
  for (const locale of Object.keys(i18n.locales)) {
    for (const page of config.pages) {
      const route = i18n.localeRoute(page.route, locale);
      const bookingUrl = (url) => { const value = new URL(url); value.searchParams.set("locale", locale); return value.href; };
      const html = templates.render("maintenance.njk", {
        locale, copy: copy[locale], base: basePath, css, logo,
        width: logoData.readUInt32BE(16), height: logoData.readUInt32BE(20),
        booking: page.route === "/reservas/", larUrl: bookingUrl(config.properties.larDeVies.bookingUrl), pradoUrl: bookingUrl(config.properties.ruralPrado.bookingUrl),
      });
      write(`${route.replace(/^\//, "")}index.html`, html);
      pages.push({ route, locale });
    }
  }
  const home = fs.readFileSync(path.join(output, "index.html"), "utf8");
  // Legacy URLs and error pages must not expose the unreleased navigation.
  for (const redirect of config.redirects) {
    const relative = redirect.from.replace(/^\//, "");
    write(relative.endsWith(".html") ? relative : `${relative.replace(/\/$/, "")}/index.html`, home);
  }
  write("404.html", home);
  write("410.html", home);
  write("robots.txt", "User-agent: *\nAllow: /\n");
  write("sitemap.xml", '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"></urlset>\n');
  write("build-manifest.json", JSON.stringify({ maintenance: true, deployEnv, siteOrigin, basePath, css, pages }, null, 2));
}
module.exports = { buildMaintenance };
