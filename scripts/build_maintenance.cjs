"use strict";
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const nunjucks = require("nunjucks");
const config = require("../site.config.cjs");
const i18n = require("../i18n.config.cjs");

const copy = {
  es: { title: "El comienzo de algo nuevo", reserve: "Reservar", choose: "Elige tu alojamiento", lar: "Suites y villas en A Pontenova", prado: "Alojamientos en San Tirso de Abres", countdown: "Nos vemos en", days: "Días", hours: "Horas", minutes: "Minutos", seconds: "Segundos", opening: "Abriendo nuestra web…", launch: "Estrenamos nuestra web el" },
  en: { title: "The beginning of something new", reserve: "Book your stay", choose: "Choose your accommodation", lar: "Suites and villas in A Pontenova", prado: "Accommodation in San Tirso de Abres", countdown: "See you in", days: "Days", hours: "Hours", minutes: "Minutes", seconds: "Seconds", opening: "Opening our website…", launch: "Our website launches on" },
  de: { title: "Der Anfang von etwas Neuem", reserve: "Jetzt buchen", choose: "Wählen Sie Ihre Unterkunft", lar: "Suiten und Villen in A Pontenova", prado: "Unterkünfte in San Tirso de Abres", countdown: "Wir sehen uns in", days: "Tage", hours: "Stunden", minutes: "Minuten", seconds: "Sekunden", opening: "Unsere Website wird geöffnet…", launch: "Unsere Website startet am" },
};

function buildMaintenance({ root, output, basePath, deployEnv, siteOrigin, launch = null, pagePrefix = "", writeControls = true }) {
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
  const logoData = fs.readFileSync(path.join(root, "images/logo lar de vies final sin fondo.png"));
  const logo = asset("logo.png", logoData);
  const landscape = asset("landscape.webp", fs.readFileSync(path.join(root, "images/home-hero-updated-desktop-2560.webp")));
  const font = asset("lora.woff2", fs.readFileSync(path.join(root, "node_modules/@fontsource/lora/files/lora-latin-400-normal.woff2")));
  const css = asset("maintenance.css", fs.readFileSync(path.join(root, "src/maintenance.css"), "utf8").replace("./lora.woff2", font));
  const js = launch ? asset("countdown.js", fs.readFileSync(path.join(root, "src/maintenance-countdown.js"))) : null;
  write("favicon.ico", fs.readFileSync(path.join(root, "favicon.ico")));
  const templates = new nunjucks.Environment(new nunjucks.FileSystemLoader(path.join(root, "src/templates")), { autoescape: true, throwOnUndefined: true });
  const pages = [];
  for (const locale of Object.keys(i18n.locales)) {
    for (const page of config.pages) {
      const route = i18n.localeRoute(page.route, locale);
      const bookingUrl = (url) => { const value = new URL(url); value.searchParams.set("locale", locale); return value.href; };
      const html = templates.render("maintenance.njk", {
        locale, copy: copy[locale], base: basePath, css, js, logo, landscape, launch,
        launchTarget: `${basePath}${route.slice(1)}`,
        launchDate: launch ? new Intl.DateTimeFormat(locale, { timeZone: "Europe/Madrid", dateStyle: "long", timeStyle: "short" }).format(launch.timestamp) : "",
        width: logoData.readUInt32BE(16), height: logoData.readUInt32BE(20),
        booking: page.route === "/reservas/", larUrl: bookingUrl(config.properties.larDeVies.bookingUrl), pradoUrl: bookingUrl(config.properties.ruralPrado.bookingUrl),
      });
      write(`${pagePrefix}${route.replace(/^\//, "")}index.html`, html);
      pages.push({ route, locale });
    }
  }
  const home = fs.readFileSync(path.join(output, pagePrefix, "index.html"), "utf8");
  // Legacy URLs and error pages must not expose the unreleased navigation.
  for (const redirect of config.redirects) {
    const relative = redirect.from.replace(/^\//, "");
    write(`${pagePrefix}${relative.endsWith(".html") ? relative : `${relative.replace(/\/$/, "")}/index.html`}`, home);
  }
  write(`${pagePrefix}404.html`, home);
  write(`${pagePrefix}410.html`, home);
  write(`${pagePrefix}robots.txt`, "User-agent: *\nAllow: /\n");
  write(`${pagePrefix}sitemap.xml`, '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"></urlset>\n');
  if (writeControls) write("build-manifest.json", JSON.stringify({ maintenance: true, deployEnv, siteOrigin, basePath, css, pages }, null, 2));
  return { css, js, pages };
}
module.exports = { buildMaintenance };
