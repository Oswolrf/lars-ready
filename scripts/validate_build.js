"use strict";

const fs = require("node:fs");
const path = require("node:path");
const cheerio = require("cheerio");
const config = require("../site.config.cjs");

const root = path.resolve(__dirname, "..");
const output = path.resolve(root, process.argv[2] || "public");
const expectedEnv = process.argv[3] || "production";
const errors = [];
const generatedDocuments = new Map();

function add(file, message) {
  errors.push(`${file}: ${message}`);
}

function outputPath(route) {
  return route === "/" ? "index.html" : `${route.replace(/^\/+|\/+$/g, "")}/index.html`;
}

function localPathFromUrl(value, basePath) {
  if (!value || /^(?:https?:|mailto:|tel:|data:|blob:|#|\/\/)/i.test(value)) return null;
  let pathname = value.split(/[?#]/, 1)[0];
  if (basePath !== "/" && pathname.startsWith(basePath)) pathname = pathname.slice(basePath.length);
  pathname = decodeURIComponent(pathname.replace(/^\//, ""));
  return pathname || "index.html";
}

if (!fs.existsSync(output)) {
  console.error(`No existe el build: ${output}`);
  process.exit(1);
}

const manifestPath = path.join(output, "build-manifest.json");
if (!fs.existsSync(manifestPath)) {
  add("build-manifest.json", "falta el manifiesto del build");
} else {
  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  if (manifest.deployEnv !== expectedEnv) add("build-manifest.json", `entorno ${manifest.deployEnv}; se esperaba ${expectedEnv}`);
  if (!/^\/assets\/css\/site-[a-f0-9]{12}\.css$/.test(manifest.css.replace(manifest.basePath === "/" ? "" : manifest.basePath.replace(/\/$/, ""), ""))) add("build-manifest.json", "CSS sin huella de contenido");
  if (!/^\/assets\/js\/site-[a-f0-9]{12}\.js$/.test(manifest.js.replace(manifest.basePath === "/" ? "" : manifest.basePath.replace(/\/$/, ""), ""))) add("build-manifest.json", "JavaScript sin huella de contenido");
}

const manifest = fs.existsSync(manifestPath) ? JSON.parse(fs.readFileSync(manifestPath, "utf8")) : { basePath: "/", siteOrigin: "https://lardevies.com" };
const contentRoot = manifest.basePath === "/"
  ? output
  : path.join(output, ...manifest.basePath.replace(/^\/+|\/+$/g, "").split("/"));

function validateLocalReference(file, value) {
  if (!value || /^(?:https?:|mailto:|tel:|data:|blob:|#|\/\/)/i.test(value)) return;
  if (/^javascript:/i.test(value)) {
    add(file, `URL JavaScript no permitida: ${value}`);
    return;
  }
  if (manifest.basePath !== "/" && value.startsWith("/") && !value.startsWith(manifest.basePath)) {
    add(file, `URL fuera de BASE_PATH ${manifest.basePath}: ${value}`);
  }
  if (manifest.basePath !== "/" && value.includes(`${manifest.basePath}${manifest.basePath.replace(/^\//, "")}`)) {
    add(file, `BASE_PATH duplicado: ${value}`);
  }
  const local = localPathFromUrl(value, manifest.basePath);
  if (!local) return;
  const clean = local.replace(/\/$/, "");
  const hasExtension = /\.[a-z0-9]{2,5}$/i.test(clean);
  const candidate = hasExtension ? clean : clean === "index.html" ? clean : `${clean}/index.html`;
  if (!fs.existsSync(path.join(contentRoot, ...candidate.split("/")))) add(file, `destino local inexistente: ${value}`);
  if (/^(?:images|videos)\//.test(clean)) add(file, `activo publicado sin hash: ${value}`);
  if (/^assets\/media\//.test(clean) && !/-[a-f0-9]{12}\.[a-z0-9]+$/i.test(clean)) add(file, `activo media sin huella: ${value}`);
}

for (const page of config.pages) {
  const relative = outputPath(page.route);
  const file = path.join(contentRoot, ...relative.split("/"));
  if (!fs.existsSync(file)) {
    add(relative, "no se generó la ruta canónica");
    continue;
  }
  const html = fs.readFileSync(file, "utf8");
  const $ = cheerio.load(html, { scriptingEnabled: false });
  generatedDocuments.set(relative, { file, html, $ });
  if (!/^<!doctype html>/i.test(html.trimStart())) add(relative, "falta doctype HTML5");
  if ($("html").attr("lang") !== "es") add(relative, "el idioma del documento debe ser es");
  if ($("head > title").length !== 1 || !$('head > title').text().trim()) add(relative, "debe tener un title único y no vacío");
  if ($('meta[name="description"]').length !== 1 || !$('meta[name="description"]').attr("content")?.trim()) add(relative, "debe tener una meta description única y no vacía");
  const ids = new Set();
  $("[id]").each((_, element) => {
    const id = $(element).attr("id");
    if (!id) add(relative, "contiene un id vacío");
    else if (ids.has(id)) add(relative, `id duplicado: #${id}`);
    else ids.add(id);
  });
  $("h1, h2, h3, h4, h5, h6").each((_, element) => {
    if (!$(element).closest("main").length) add(relative, `encabezado fuera de main: ${$(element).prop("tagName")?.toLowerCase() || "heading"}`);
  });
  $("button").each((_, element) => {
    const button = $(element);
    if (!button.attr("type")) add(relative, "botón sin atributo type");
    if (!(button.attr("aria-label") || button.attr("title") || button.text().trim())) add(relative, "botón sin nombre accesible");
  });
  const robots = $('meta[name="robots"]').attr("content") || "";
  const canonical = $('link[rel="canonical"]').attr("href") || "";
  if (expectedEnv === "preview" && !robots.includes("noindex")) add(relative, "preview indexable");
  if (expectedEnv === "production" && page.indexable !== false && robots.includes("noindex")) add(relative, "producción indexable marcada noindex");
  if (expectedEnv === "production" && page.indexable === false && !robots.includes("noindex")) add(relative, "página legal sin noindex");
  if (canonical !== `${manifest.siteOrigin}${manifest.basePath === "/" ? page.route : `${manifest.basePath}${page.route.replace(/^\//, "")}`}`) add(relative, `canonical inesperada: ${canonical}`);
  if ($("main#main-content").length !== 1) add(relative, "debe tener exactamente un main#main-content");
  if ($("h1").length !== 1) add(relative, `debe tener un H1; encontrados ${$("h1").length}`);
  if (!$('a[href="#main-content"]').length) add(relative, "falta skip link");
  if (!$('nav[aria-label="Navegación principal"]').length) add(relative, "falta nombre de navegación principal");
  if (!$('[data-booking-dialog]').length) add(relative, "falta selector de reserva estático");
  if (/fonts\.googleapis|fonts\.gstatic|cdnjs\.cloudflare|unpkg\.com|transparenttextures\.com/i.test(html)) add(relative, "conserva CDN visual o de animación");
  if (/material-symbols-outlined/.test(html)) add(relative, "conserva la fuente completa de Material Symbols");
  if (manifest.basePath !== "/") {
    for (const match of html.matchAll(/(?:href|src|poster|data-src)=["'](\/[^"']*)/gi)) {
      if (!match[1].startsWith("//") && !match[1].startsWith(manifest.basePath)) {
        add(relative, `URL absoluta fuera de ${manifest.basePath}: ${match[1]}`);
      }
    }
  }
  if (/<(?:script|link)[^>]+(?:src|href)=["'][^"']+\.html(?:[?#][^"']*)?["']/i.test(html)) add(relative, "enlace interno físico .html");
  if (/<video[^>]+data-hero-video/i.test(html)) {
    if (!/<source[^>]+data-src=/i.test(html)) add(relative, "hero video sin carga diferida");
    if (/<source[^>]+\ssrc=/i.test($("video[data-hero-video]").html() || "")) add(relative, "hero video descarga fuentes de inmediato");
    if (!$("picture.hero-poster img[fetchpriority=high]").length) add(relative, "hero sin póster prioritario");
  }
  $("[src], [href], [poster], [data-src]").each((_, element) => {
    const node = $(element);
    for (const attribute of ["src", "href", "poster", "data-src"]) {
      const value = node.attr(attribute);
      if (value) validateLocalReference(relative, value);
    }
  });
  $("[srcset], [data-srcset], [imagesrcset]").each((_, element) => {
    const node = $(element);
    for (const attribute of ["srcset", "data-srcset", "imagesrcset"]) {
      const value = node.attr(attribute);
      if (!value) continue;
      for (const candidate of value.split(",")) validateLocalReference(relative, candidate.trim().split(/\s+/, 1)[0]);
    }
  });
}

for (const [relative, document] of generatedDocuments) {
  const $ = document.$;
  $("a[href*='#']").each((_, element) => {
    const href = $(element).attr("href");
    if (!href || /^(?:https?:|mailto:|tel:|data:|blob:|\/\/)/i.test(href)) return;
    const hashIndex = href.indexOf("#");
    if (hashIndex < 0) return;
    const targetUrl = href.slice(0, hashIndex);
    const encodedFragment = href.slice(hashIndex + 1);
    if (!encodedFragment) {
      add(relative, `fragmento vacío: ${href}`);
      return;
    }
    let fragment;
    try {
      fragment = decodeURIComponent(encodedFragment);
    } catch {
      add(relative, `fragmento mal codificado: ${href}`);
      return;
    }
    const targetLocal = targetUrl ? localPathFromUrl(targetUrl, manifest.basePath) : relative;
    if (!targetLocal) return;
    const clean = targetLocal.replace(/\/$/, "");
    const targetRelative = /\.[a-z0-9]{2,5}$/i.test(clean)
      ? clean
      : clean === "index.html" ? clean : `${clean}/index.html`;
    const targetFile = path.join(contentRoot, ...targetRelative.split("/"));
    if (!fs.existsSync(targetFile)) return;
    const targetDocument = generatedDocuments.get(targetRelative);
    const target$ = targetDocument?.$ || cheerio.load(fs.readFileSync(targetFile, "utf8"), { scriptingEnabled: false });
    const found = target$("[id]").toArray().some((node) => target$(node).attr("id") === fragment);
    if (!found) add(relative, `fragmento interno inexistente: ${href}`);
  });
}

for (const required of ["404.html", "410.html", "sitemap.xml"]) {
  if (!fs.existsSync(path.join(contentRoot, ...required.split("/")))) add(required, "no se generó");
}
for (const required of ["robots.txt", "_headers", "_redirects", ".htaccess", "deploy/nginx.conf.example", "deploy/vercel.json"]) {
  if (!fs.existsSync(path.join(output, ...required.split("/")))) add(required, "no se generó");
}

for (const route of config.gone) {
  const file = path.join(contentRoot, ...outputPath(route).split("/"));
  if (!fs.existsSync(file)) add(route, "falta fallback de contenido retirado");
}

const cssPath = localPathFromUrl(manifest.css, manifest.basePath);
if (cssPath && fs.existsSync(path.join(contentRoot, ...cssPath.split("/")))) {
  const css = fs.readFileSync(path.join(contentRoot, ...cssPath.split("/")), "utf8");
  for (const match of css.matchAll(/url\(\s*["']?([^"')]+)["']?\s*\)/g)) validateLocalReference(path.basename(cssPath), match[1]);
}

const jsPath = localPathFromUrl(manifest.js, manifest.basePath);
if (jsPath && fs.existsSync(path.join(contentRoot, ...jsPath.split("/")))) {
  const javascript = fs.readFileSync(path.join(contentRoot, ...jsPath.split("/")), "utf8");
  if (/["'`](?:thumb:)?(?:images|videos)\//.test(javascript)) add(path.basename(jsPath), "conserva rutas de medios relativas o marcadores sin resolver");
  for (const match of javascript.matchAll(/["'`](\/[^"'`]+)["'`]/g)) {
    const value = match[1];
    const pathname = value.split(/[?#]/, 1)[0];
    const configuredRoute = config.pages.some((page) => pathname === `${manifest.basePath === "/" ? "" : manifest.basePath.replace(/\/$/, "")}${page.route}`);
    if (/\.(?:avif|gif|ico|jpe?g|js|mp4|png|svg|webm|webp|woff2)$/i.test(pathname) || configuredRoute) {
      validateLocalReference(path.basename(jsPath), value);
    }
  }
}

for (const relative of ["404.html", "410.html", ...config.gone.map(outputPath)]) {
  const target = path.join(contentRoot, ...relative.split("/"));
  if (!fs.existsSync(target)) continue;
  const $ = cheerio.load(fs.readFileSync(target, "utf8"));
  $("[src], [href]").each((_, element) => {
    validateLocalReference(relative, $(element).attr("src") || $(element).attr("href"));
  });
}

for (const legacyDirectory of ["images", "videos", "css", "dist", "js"]) {
  if (fs.existsSync(path.join(contentRoot, legacyDirectory))) add(legacyDirectory, "directorio legacy publicado; los activos deben estar hasheados en /assets");
}

const robotsText = fs.existsSync(path.join(output, "robots.txt")) ? fs.readFileSync(path.join(output, "robots.txt"), "utf8") : "";
if (expectedEnv === "production") {
  for (const bot of ["OAI-SearchBot", "ChatGPT-User", "Claude-SearchBot", "PerplexityBot"]) {
    if (!robotsText.includes(`User-agent: ${bot}`)) add("robots.txt", `falta política para ${bot}`);
  }
  for (const bot of ["GPTBot", "ClaudeBot"]) {
    const block = new RegExp(`User-agent: ${bot}\\s+Disallow: /`, "i");
    if (!block.test(robotsText)) add("robots.txt", `${bot} no está bloqueado`);
  }
}

if (errors.length) {
  console.error(errors.join("\n"));
  console.error(`\nErrores del build: ${errors.length}`);
  process.exit(1);
}

console.log(`Build ${expectedEnv}: ${config.pages.length} rutas canónicas verificadas`);
console.log("HTML, indexación, activos, reservas y adaptadores: OK");
