"use strict";

const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const cheerio = require("cheerio");
const config = require("../site.config.cjs");

const root = path.resolve(__dirname, "..");
const errors = [];
const sourceSet = new Set();
const routeSet = new Set();
const displayCharacters = new Set();
const heroCharacters = new Set();

function add(file, message) {
  errors.push(`${file}: ${message}`);
}

function read(file) {
  return fs.readFileSync(path.join(root, ...file.replaceAll("\\", "/").split("/")), "utf8");
}

function validateBookingUrl(file, rawValue) {
  const value = rawValue.replaceAll("&amp;", "&");
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.hostname !== "direct-book.com" || !url.pathname.startsWith("/properties/")) {
      add(file, `destino de reserva no permitido: ${rawValue}`);
    }
    if (url.searchParams.has("checkInDate") || url.searchParams.has("checkOutDate")) add(file, "URL de reserva con fechas absolutas");
  } catch (_error) {
    add(file, `URL de reserva inválida: ${rawValue}`);
  }
}

for (const page of config.pages) {
  if (sourceSet.has(page.source)) add("site.config.cjs", `fuente duplicada: ${page.source}`);
  if (routeSet.has(page.route)) add("site.config.cjs", `ruta duplicada: ${page.route}`);
  sourceSet.add(page.source);
  routeSet.add(page.route);
  if (page.route !== "/" && !/^\/.*\/$/.test(page.route)) add("site.config.cjs", `ruta no canónica: ${page.route}`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(page.lastModified)) add("site.config.cjs", `lastModified inválido en ${page.route}`);
  const source = path.join(root, ...page.source.replaceAll("\\", "/").split("/"));
  if (!fs.existsSync(source)) {
    add(page.source, "página fuente inexistente");
    continue;
  }
  const html = fs.readFileSync(source, "utf8");
  const $ = cheerio.load(html);
  if ($("h1").length !== 1) add(page.source, `debe contener un H1; encontrados ${$("h1").length}`);
  if ($("main").length !== 1) add(page.source, `debe contener un main; encontrados ${$("main").length}`);
  if ($("main#main-content").length !== 1) add(page.source, "main debe usar id=main-content");
  if (!$('a[href="#main-content"]').length) add(page.source, "falta enlace para saltar al contenido");
  if (/<script\b(?![^>]*type=["']application\/ld\+json["'])(?![^>]*src=)[^>]*>/i.test(html)) add(page.source, "contiene JavaScript ejecutable inline");
  if (/\son[a-z]+\s*=\s*["']/i.test(html)) add(page.source, "contiene manejador de evento inline");
  if (/\b(?:href|src)=["'][^"']+\.html(?:[?#][^"']*)?["']/i.test(html)) add(page.source, "contiene enlace interno físico .html");
  if (/src=["']data:image\/gif;base64/i.test(html) || /class=["'][^"']*lazy-strict/i.test(html)) add(page.source, "imagen esencial dependiente de lazy loading personalizado");
  $("iframe").each((_, frame) => { if (!$(frame).attr("title")) add(page.source, "iframe sin title"); });
  $("img").each((_, image) => {
    const node = $(image);
    if (node.attr("alt") === undefined) add(page.source, "imagen sin alt");
    if (!node.attr("src")) add(page.source, "imagen sin src real");
  });
  $(".font-display, .font-serif").each((_, element) => {
    const text = $(element).text().replace(/\s+/g, " ").trim();
    for (const character of text) displayCharacters.add(character);
  });
  $("main header h1.font-display").each((_, element) => {
    const heading = $(element);
    if (heading.find(".italic").length) return;
    const text = heading.text().replace(/\s+/g, " ").trim();
    for (const character of text) heroCharacters.add(character);
  });
  const ids = new Set();
  $("[id]").each((_, element) => {
    const id = $(element).attr("id");
    if (ids.has(id)) add(page.source, `id duplicado: ${id}`);
    ids.add(id);
  });
  $("a[href*='direct-book.com']").each((_, anchor) => {
    const node = $(anchor);
    validateBookingUrl(page.source, node.attr("href"));
    if (!node.closest("#elegir-alojamiento").length && !node.is("[data-booking-property]")) {
      add(page.source, "CTA directo fuera del selector progresivo de reservas");
    }
  });
  $("a[target='_blank']").each((_, anchor) => {
    const rel = new Set(($(anchor).attr("rel") || "").toLowerCase().split(/\s+/));
    if (!rel.has("noopener") || !rel.has("noreferrer")) add(page.source, "target=_blank sin noopener noreferrer");
  });
}

const criticalGlyphsPath = path.join(root, "assets", "generated", "fonts", "lora-critical-glyphs.txt");
const criticalFontPath = path.join(root, "assets", "generated", "fonts", "lora-latin-400-critical.woff2");
const heroGlyphsPath = path.join(root, "assets", "generated", "fonts", "lora-hero-glyphs.txt");
const heroFontPath = path.join(root, "assets", "generated", "fonts", "lora-latin-400-hero.woff2");
if (!fs.existsSync(criticalGlyphsPath) || !fs.existsSync(criticalFontPath)) {
  add("assets/generated/fonts", "faltan el subconjunto Lora crítico o su lista de caracteres");
} else {
  const configuredGlyphs = new Set(fs.readFileSync(criticalGlyphsPath, "utf8").replace(/[\r\n]/g, ""));
  const missingGlyphs = [...displayCharacters].filter((character) => !configuredGlyphs.has(character));
  if (missingGlyphs.length) add("assets/generated/fonts/lora-critical-glyphs.txt", `faltan caracteres visibles: ${missingGlyphs.join("")}`);
  const originalLora = require.resolve("@fontsource/lora/files/lora-latin-400-normal.woff2", { paths: [root] });
  if (fs.statSync(criticalFontPath).size >= fs.statSync(originalLora).size) {
    add("assets/generated/fonts/lora-latin-400-critical.woff2", "el subconjunto no reduce la fuente latina original");
  }
  if (!fs.existsSync(heroGlyphsPath) || !fs.existsSync(heroFontPath)) {
    add("assets/generated/fonts", "faltan el subconjunto Lora hero o su lista de caracteres");
  } else {
    const configuredHeroGlyphs = new Set(fs.readFileSync(heroGlyphsPath, "utf8").replace(/[\r\n]/g, ""));
    const missingHeroGlyphs = [...heroCharacters].filter((character) => !configuredHeroGlyphs.has(character));
    if (missingHeroGlyphs.length) add("assets/generated/fonts/lora-hero-glyphs.txt", `faltan caracteres de H1: ${missingHeroGlyphs.join("")}`);
    if (fs.statSync(heroFontPath).size >= fs.statSync(criticalFontPath).size) {
      add("assets/generated/fonts/lora-latin-400-hero.woff2", "el subconjunto hero no reduce el subconjunto crítico general");
    }
  }
}

for (const special of config.specialPages) {
  if (!fs.existsSync(path.join(root, special.source))) add(special.source, "página especial inexistente");
}

for (const [name, property] of Object.entries(config.properties)) {
  validateBookingUrl(`site.config.cjs#${name}`, property.bookingUrl);
}

for (const [name, hero] of Object.entries(config.heroVideos)) {
  if (!hero[hero.selected]) add("site.config.cjs", `variante ${hero.selected} inexistente en hero ${name}`);
  for (const variant of ["original", "optimized"]) {
    for (const file of Object.values(hero[variant])) {
      const absolute = path.join(root, ...file.replace(/^\//, "").split("/"));
      if (!fs.existsSync(absolute)) add("site.config.cjs", `vídeo ${variant} inexistente: ${file}`);
    }
  }
  if (hero.original.mp4 === hero.optimized.mp4 || hero.original.webm === hero.optimized.webm) add("site.config.cjs", `hero ${name} sobrescribe su original`);
}

const derivativeManifestPath = path.join(root, "assets", "generated", "videos", "manifest-v3.json");
if (!fs.existsSync(derivativeManifestPath)) {
  add("assets/generated/videos/manifest-v3.json", "falta el manifiesto inmutable de los derivados aprobados");
} else {
  const derivativeManifest = JSON.parse(fs.readFileSync(derivativeManifestPath, "utf8"));
  const configuredOptimized = new Set(Object.values(config.heroVideos).flatMap((hero) => Object.values(hero.optimized).map((value) => value.replace(/^\//, ""))));
  for (const entry of derivativeManifest.entries || []) {
    const source = path.join(root, ...entry.source.split("/"));
    if (fs.existsSync(source)) {
      const bytes = fs.statSync(source).size;
      const sha256 = crypto.createHash("sha256").update(fs.readFileSync(source)).digest("hex");
      if (bytes !== entry.sourceBytes || sha256 !== entry.sourceSha256) add(entry.source, "el vídeo original no coincide con su hash registrado");
    }
    for (const derivative of entry.derivatives || []) {
      const candidate = path.join(root, ...derivative.path.split("/"));
      if (!fs.existsSync(candidate)) {
        add(derivative.path, "derivado aprobado inexistente");
        continue;
      }
      const bytes = fs.statSync(candidate).size;
      const limit = derivative.format === "webm" ? 2.5 * 1024 * 1024 : 3 * 1024 * 1024;
      if (bytes !== derivative.bytes) add(derivative.path, "tamaño distinto al manifiesto aprobado");
      if (bytes > limit) add(derivative.path, `supera el presupuesto ${derivative.format}`);
      if (!configuredOptimized.has(derivative.path)) add(derivative.path, "derivado aprobado no seleccionado en site.config.cjs");
    }
  }
}

for (const script of ["scripts/build_static.js", "scripts/validate_build.js", "scripts/serve_static.js", "scripts/media/prepare-hero-videos.js", "scripts/media/compare-hero-videos.js"]) {
  if (!fs.existsSync(path.join(root, ...script.split("/")))) add(script, "falta el contrato de build/prueba");
}

if (fs.existsSync(path.join(root, "vercel.json"))) {
  const vercel = JSON.parse(read("vercel.json"));
  const catchAll = (vercel.headers || []).find((entry) => entry.source === "/(.*)" || entry.source === "/:path*");
  const robotsHeader = (catchAll?.headers || []).find((header) => header.key.toLowerCase() === "x-robots-tag")?.value || "";
  if (/noindex/i.test(robotsHeader)) add("vercel.json", "noindex global bloquearía una producción en Vercel");
  const csp = (catchAll?.headers || []).find((header) => header.key.toLowerCase() === "content-security-policy")?.value || "";
  if (csp && !/script-src-attr\s+'none'/.test(csp)) add("vercel.json", "CSP sin script-src-attr 'none'");
}

if (errors.length) {
  console.error(errors.join("\n"));
  console.error(`\nErrores de validación estática: ${errors.length}`);
  process.exit(1);
}

console.log(`Páginas fuente verificadas: ${config.pages.length}`);
console.log("Rutas, HTML, reservas, medios originales y configuración: OK");
