"use strict";

// One-off content translation helper. The generated dictionaries are committed
// and consumed locally by the static build; production builds never call an
// external translation service.
const fs = require("node:fs");
const path = require("node:path");
const cheerio = require("cheerio");
const config = require("../site.config.cjs");

const root = path.resolve(__dirname, "..");
const localeDirectory = path.join(root, "locales");
const targets = new Set(process.argv.slice(2).filter((value) => ["en", "de"].includes(value)));
if (!targets.size) {
  targets.add("en");
  targets.add("de");
}

const ignoredText = new Set([
  "accessible", "airline_seat_flat", "arrow_forward", "bathroom", "bed", "block",
  "calendar_month", "call", "chair", "check", "chevron_left", "chevron_right",
  "child_care", "close", "cloud", "coffee", "countertops", "directions_car", "eco",
  "expand_less", "expand_more", "face", "favorite", "fireplace", "group", "home",
  "king_bed", "kitchen", "landscape", "menu", "open_in_new", "pets", "photo_library",
  "restaurant", "schedule", "shower", "skillet", "smoke_free", "sunny", "table_restaurant",
  "trending_up", "tv", "water_drop", "wb_sunny", "wc", "wifi",
]);

const translatableAttributes = [
  "alt", "aria-label", "placeholder", "title", "data-sticky-cta-label",
  "data-book-label", "data-label", "data-chat-suggestion",
];

function addText(strings, value) {
  const text = String(value || "").replace(/\s+/g, " ").trim();
  if (!text || ignoredText.has(text) || /[{][{%]/.test(text)) return;
  if (!/[A-Za-zÁÉÍÓÚÜáéíóúüÑñ¿¡]/.test(text)) return;
  strings.add(text);
}

function collectFromHtml(strings, source) {
  const $ = cheerio.load(source, { decodeEntities: false, scriptingEnabled: false });
  $("style, script, noscript, svg, .material-symbols-outlined, .material-icon").remove();
  $("body *").contents().each((_, node) => {
    if (node.type === "text") addText(strings, $(node).text());
  });
  $(translatableAttributes.map((attribute) => `[${attribute}]`).join(",")).each((_, node) => {
    for (const attribute of translatableAttributes) addText(strings, $(node).attr(attribute));
  });
}

function collectStrings() {
  const strings = new Set();
  for (const page of config.pages) {
    collectFromHtml(strings, fs.readFileSync(path.join(root, page.source), "utf8"));
    for (const key of ["title", "description", "ogTitle", "imageAlt"]) addText(strings, page[key]);
  }
  for (const filename of fs.readdirSync(path.join(root, "src", "templates", "partials"))) {
    if (filename.endsWith(".njk")) {
      collectFromHtml(strings, fs.readFileSync(path.join(root, "src", "templates", "partials", filename), "utf8"));
    }
  }
  return [...strings].sort((a, b) => a.localeCompare(b, "es"));
}

const protectedNames = [
  "Lar de Víes", "Lar de Vies", "Rural Prado", "A Pontenova", "Neipín",
  "San Tirso de Abres", "OpenAI", "Supabase", "Ameiro", "Bidueira", "Carballo",
  "Castañeiro", "Salgueiro", "El Cabozo", "El Jardín", "El Valle", "La Capilla",
  "La Panera", "Villa Camelia", "Villa El Camino", "Villa Jazmín",
];

function protectNames(text) {
  const names = [];
  let protectedText = text;
  for (const name of protectedNames) {
    protectedText = protectedText.split(name).join(`[[LAR${names.length}]]`);
    names.push(name);
  }
  return { protectedText, names };
}

function restoreNames(text, names) {
  let restored = text;
  names.forEach((name, index) => {
    restored = restored.replace(new RegExp(`\\[\\[\\s*LAR\\s*${index}\\s*\\]\\]`, "gi"), name);
  });
  return restored.replaceAll("Lar de Vies", "Lar de Víes");
}

async function translate(text, target, attempt = 1) {
  const { protectedText, names } = protectNames(text);
  const endpoint = new URL("https://translate.googleapis.com/translate_a/single");
  endpoint.searchParams.set("client", "gtx");
  endpoint.searchParams.set("sl", "es");
  endpoint.searchParams.set("tl", target);
  endpoint.searchParams.set("dt", "t");
  endpoint.searchParams.set("q", protectedText);
  try {
    const response = await fetch(endpoint, { signal: AbortSignal.timeout(20000) });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const payload = await response.json();
    const translated = Array.isArray(payload?.[0])
      ? payload[0].map((part) => part?.[0] || "").join("")
      : "";
    if (!translated) throw new Error("empty response");
    return restoreNames(translated, names);
  } catch (error) {
    if (attempt >= 4) throw error;
    await new Promise((resolve) => setTimeout(resolve, 400 * (2 ** attempt)));
    return translate(text, target, attempt + 1);
  }
}

async function runPool(items, worker, concurrency = 6) {
  let cursor = 0;
  const results = new Array(items.length);
  await Promise.all(Array.from({ length: concurrency }, async () => {
    while (cursor < items.length) {
      const index = cursor++;
      results[index] = await worker(items[index], index);
    }
  }));
  return results;
}

async function buildLocale(locale, strings) {
  fs.mkdirSync(localeDirectory, { recursive: true });
  const filename = path.join(localeDirectory, `${locale}.json`);
  const dictionary = fs.existsSync(filename) ? JSON.parse(fs.readFileSync(filename, "utf8")) : {};
  const missing = strings.filter((text) => !dictionary[text]);
  console.log(`${locale}: ${strings.length - missing.length} cached; ${missing.length} pending`);
  let completed = 0;
  const translations = await runPool(missing, async (text) => {
    const translated = await translate(text, locale);
    completed += 1;
    if (completed % 25 === 0 || completed === missing.length) console.log(`${locale}: ${completed}/${missing.length}`);
    return translated;
  });
  missing.forEach((text, index) => { dictionary[text] = translations[index]; });
  const ordered = Object.fromEntries(Object.keys(dictionary).sort((a, b) => a.localeCompare(b, "es")).map((key) => [key, dictionary[key]]));
  fs.writeFileSync(filename, `${JSON.stringify(ordered, null, 2)}\n`);
}

async function main() {
  const strings = collectStrings();
  console.log(`Collected ${strings.length} translatable strings`);
  for (const locale of targets) await buildLocale(locale, strings);
}

main().catch((error) => {
  console.error(error.stack || error.message || error);
  process.exitCode = 1;
});
