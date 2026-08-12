const fs = require("node:fs");
const path = require("node:path");
const siteConfig = require("../site.config.cjs");

const root = path.resolve(__dirname, "..");
const siteOrigin = siteConfig.site.defaultOrigin.replace(/\/$/, "");
const htmlFiles = [
  ...siteConfig.pages.map((page) => page.source),
  ...siteConfig.specialPages.map((page) => page.source),
];
const finalRoutes = new Set(siteConfig.pages.map((page) => page.route));
const redirectRoutes = new Set(siteConfig.redirects.map((redirect) => redirect.from));
const expectedCanonicalByFile = new Map(
  siteConfig.pages.map((page) => [page.source, `${siteOrigin}${page.route}`]),
);
const manifestPageBySource = new Map(
  siteConfig.pages.map((page) => [page.source, page]),
);
const ruralPradoEntityId = `${siteOrigin}${siteConfig.properties.ruralPrado.entityId}`;
const manifestLastModifiedByUrl = new Map(
  siteConfig.pages
    .filter((page) => page.indexable !== false)
    .map((page) => [`${siteOrigin}${page.route}`, page.lastModified]),
);

const errors = [];
const warnings = [];
const seenTitles = new Map();
const seenDescriptions = new Map();
const seenCanonicals = new Map();
const indexableCanonicals = new Set();
const legacyInternalLinks = new Map();

function match(html, pattern) {
  return html.match(pattern)?.[1]?.trim() || "";
}

function addSeen(map, value, file, label) {
  if (!value) return;
  if (map.has(value)) {
    errors.push(`${file}: ${label} duplicado con ${map.get(value)}`);
  } else {
    map.set(value, file);
  }
}

for (const file of htmlFiles) {
  const fullPath = path.join(root, file);
  if (!fs.existsSync(fullPath)) {
    errors.push(`${file}: archivo ausente`);
    continue;
  }

  const html = fs.readFileSync(fullPath, "utf8");
  const hasRootBase = /<base\s+href="\/"\s*\/?>/i.test(html);
  const title = match(html, /<title>([\s\S]*?)<\/title>/i);
  const description = match(
    html,
    /<meta\s+name="description"\s+content="([^"]*)"/i,
  );
  const robots = match(html, /<meta\s+name="robots"\s+content="([^"]*)"/i);
  const canonical = match(
    html,
    /<link\s+rel="canonical"\s+href="([^"]*)"/i,
  );
  const h1Count = (html.match(/<h1\b/gi) || []).length;
  const manifestPage = manifestPageBySource.get(file);

  if (!title) errors.push(`${file}: falta title`);
  if (file !== "404.html" && !description) {
    errors.push(`${file}: falta meta description`);
  }
  if (file !== "404.html" && !robots) {
    errors.push(`${file}: falta meta robots`);
  }
  if (file !== "404.html" && !canonical) {
    errors.push(`${file}: falta canonical`);
  }
  if (manifestPage && title !== manifestPage.title) {
    errors.push(`${file}: title no coincide con site.config.cjs`);
  }
  if (manifestPage && description !== manifestPage.description) {
    errors.push(`${file}: description no coincide con site.config.cjs`);
  }
  const expectedCanonical = expectedCanonicalByFile.get(file);
  if (expectedCanonical && canonical !== expectedCanonical) {
    errors.push(
      `${file}: canonical ${canonical || "ausente"}; se esperaba ${expectedCanonical}`,
    );
  }
  if (h1Count !== 1) {
    errors.push(`${file}: contiene ${h1Count} H1`);
  }

  if (title.length > 60) {
    warnings.push(`${file}: title largo (${title.length})`);
  }
  if (description && (description.length < 90 || description.length > 160)) {
    warnings.push(`${file}: description de ${description.length} caracteres`);
  }

  addSeen(seenTitles, title, file, "title");
  if (file !== "404.html") {
    addSeen(seenDescriptions, description, file, "description");
    addSeen(seenCanonicals, canonical, file, "canonical");
  }

  if (canonical && !robots.includes("noindex")) {
    indexableCanonicals.add(canonical);
  }

  const jsonLdBlocks = [
    ...html.matchAll(
      /<script\s+type="application\/ld\+json">([\s\S]*?)<\/script>/gi,
    ),
  ];
  const parsedJsonLd = [];
  for (const block of jsonLdBlocks) {
    try {
      parsedJsonLd.push(JSON.parse(block[1]));
    } catch (error) {
      errors.push(`${file}: JSON-LD inválido (${error.message})`);
    }
  }
  if (
    file !== "404.html" &&
    !robots.includes("noindex") &&
    jsonLdBlocks.length === 0
  ) {
    errors.push(`${file}: falta JSON-LD`);
  }

  const schemaNodes = parsedJsonLd.flatMap((schema) =>
    Array.isArray(schema?.["@graph"]) ? schema["@graph"] : [schema],
  );
  if (file === "Entorno.html") {
    const destination = schemaNodes.find(
      (node) => node?.["@type"] === "TouristDestination",
    );
    if (!destination) {
      errors.push(`${file}: falta TouristDestination`);
    } else {
      if (
        destination.name !==
        "Reserva de la Biosfera Río Eo, Oscos y Terras de Burón"
      ) {
        errors.push(`${file}: nombre oficial de la Reserva incorrecto`);
      }
      if ("geo" in destination) {
        errors.push(`${file}: TouristDestination no debe heredar el geo del alojamiento`);
      }
      if (!/^https:\/\/www\.miteco\.gob\.es\//.test(destination.sameAs || "")) {
        errors.push(`${file}: TouristDestination debe enlazar la fuente oficial de MITECO`);
      }
    }
    if (/href="https:\/\/direct-book\.com/i.test(html)) {
      errors.push(`${file}: conserva un CTA directo en lugar del selector común`);
    }
    if (!html.includes('/reservas/#elegir-alojamiento')) {
      errors.push(`${file}: falta el fallback al selector común de reservas`);
    }
  }
  if (file === "OtrosAlojamientos.html") {
    const ruralPrado = schemaNodes.find(
      (node) =>
        node?.["@type"] === "LodgingBusiness" &&
        node?.["@id"] === ruralPradoEntityId,
    );
    if (!ruralPrado) {
      errors.push(`${file}: falta la entidad independiente Rural Prado`);
    } else {
      for (const unsupported of [
        "address",
        "telephone",
        "email",
        "identifier",
        "occupancy",
        "brand",
        "parentOrganization",
      ]) {
        if (unsupported in ruralPrado) {
          errors.push(`${file}: Rural Prado publica el dato no confirmado ${unsupported}`);
        }
      }
    }
    if (/direct-book\.com/i.test(html)) {
      errors.push(`${file}: conserva un CTA directo en lugar del selector común`);
    }
    if (!html.includes('/reservas/#elegir-alojamiento')) {
      errors.push(`${file}: falta el fallback al selector común de reservas`);
    }
    const galleryButtons = [
      ...html.matchAll(
        /<button\b[^>]*data-gallery-open[^>]*>([\s\S]*?)<\/button>/gi,
      ),
    ];
    for (const button of galleryButtons) {
      if (/<(?:article|div|h[1-6]|p|section)\b/i.test(button[1])) {
        errors.push(`${file}: control de galería con contenido de bloque no válido`);
      }
    }
  }

  const images = [...html.matchAll(/<img\b([^>]*)>/gi)];
  for (const image of images) {
    const attributes = image[1];
    if (!/\balt\s*=/i.test(attributes)) {
      errors.push(`${file}: imagen sin atributo alt`);
    }
  }

  const sourceResources = [
    ...html.matchAll(/\s(?:src|data-src)="([^"]+)"/gi),
  ].map((resource) => resource[1]);
  const linkedResources = [
    ...html.matchAll(/\s(?:href|src|data-src|poster)="([^"]+)"/gi),
  ].map((resource) => resource[1]);
  const srcsetResources = [
    ...html.matchAll(/\s(?:srcset|data-srcset|imagesrcset)="([^"]+)"/gi),
  ].flatMap((resource) =>
    resource[1]
      .split(",")
      .map((candidate) => candidate.trim().split(/\s+/)[0])
      .filter(Boolean),
  );
  for (const candidate of [...linkedResources, ...srcsetResources]) {
    if (!hasRootBase && /^(?:\.\.\/)?(?:dist|css|images|videos|js)\//i.test(candidate)) {
      errors.push(
        `${file}: la ruta de recurso debe partir de la raíz /${candidate}`,
      );
    }
  }
  for (const candidate of [...sourceResources, ...srcsetResources]) {
    const candidates = [candidate];
    for (const candidate of candidates) {
      if (
        candidate.startsWith("http") ||
        candidate.startsWith("data:") ||
        candidate.startsWith("//")
      ) {
        continue;
      }
      const cleanResource = candidate.split("?")[0];
      const localResource = cleanResource.startsWith("/")
        ? path.join(root, decodeURIComponent(cleanResource.slice(1)))
        : path.resolve(path.dirname(fullPath), decodeURIComponent(cleanResource));
      if (!fs.existsSync(localResource)) {
        errors.push(`${file}: recurso multimedia ausente ${candidate}`);
      }
    }
  }

  const links = [...html.matchAll(/href="([^"]+)"/gi)].map(
    (item) => item[1],
  );
  for (const href of links) {
    if (
      href.startsWith("http") ||
      href.startsWith("mailto:") ||
      href.startsWith("tel:") ||
      href.startsWith("#")
    ) {
      continue;
    }
    const cleanHref = href.split("#")[0].split("?")[0];
    if (cleanHref.startsWith("/") && !path.extname(cleanHref)) {
      if (redirectRoutes.has(cleanHref)) {
        const files = legacyInternalLinks.get(cleanHref) || new Set();
        files.add(file);
        legacyInternalLinks.set(cleanHref, files);
      } else if (!finalRoutes.has(cleanHref)) {
        errors.push(`${file}: ruta interna desconocida ${href}`);
      }
      continue;
    }
    if (cleanHref.startsWith("/")) {
      const localTarget = path.join(root, decodeURIComponent(cleanHref.slice(1)));
      if (!fs.existsSync(localTarget)) {
        errors.push(`${file}: recurso ausente ${href}`);
      }
      continue;
    }
    const localTarget = path.resolve(path.dirname(fullPath), decodeURIComponent(cleanHref));
    if (!fs.existsSync(localTarget)) {
      errors.push(`${file}: recurso relativo ausente ${href}`);
    }
  }
}

for (const [route, files] of legacyInternalLinks) {
  warnings.push(
    `${route}: enlace interno legado aún presente en ${[...files].sort().join(", ")}`,
  );
}

const sitemapPath = path.join(root, "sitemap.xml");
const sitemap = fs.readFileSync(sitemapPath, "utf8");
const sitemapEntries = [...sitemap.matchAll(/<url>([\s\S]*?)<\/url>/g)].map(
  (entry) => ({
    loc: match(entry[1], /<loc>([^<]+)<\/loc>/),
    lastmod: match(entry[1], /<lastmod>([^<]+)<\/lastmod>/),
  }),
);
const sitemapUrls = new Set(sitemapEntries.map((entry) => entry.loc).filter(Boolean));
if (sitemapEntries.length !== sitemapUrls.size) {
  errors.push("sitemap.xml: contiene URLs vacías o duplicadas");
}
const today = new Date().toISOString().slice(0, 10);
for (const entry of sitemapEntries) {
  if (!/^https:\/\/lardevies\.com\//.test(entry.loc)) {
    errors.push(`sitemap.xml: URL no canónica ${entry.loc || "vacía"}`);
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(entry.lastmod)) {
    errors.push(`sitemap.xml: lastmod ausente o inválido para ${entry.loc}`);
  } else if (entry.lastmod > today) {
    errors.push(`sitemap.xml: lastmod futuro para ${entry.loc}`);
  }
  const expectedLastModified = manifestLastModifiedByUrl.get(entry.loc);
  if (expectedLastModified && entry.lastmod !== expectedLastModified) {
    errors.push(`sitemap.xml: lastmod de ${entry.loc} no coincide con site.config.cjs`);
  }
}
for (const canonical of indexableCanonicals) {
  if (!sitemapUrls.has(canonical)) {
    errors.push(`sitemap.xml: falta ${canonical}`);
  }
}
for (const url of sitemapUrls) {
  if (!indexableCanonicals.has(url)) {
    errors.push(`sitemap.xml: URL no indexable o desconocida ${url}`);
  }
}

const robotsPath = path.join(root, "robots.txt");
const robotsText = fs.readFileSync(robotsPath, "utf8");
for (const allowedBot of [
  "Googlebot",
  "Bingbot",
  "OAI-SearchBot",
  "ChatGPT-User",
  "Claude-SearchBot",
  "Claude-User",
  "PerplexityBot",
  "Perplexity-User",
]) {
  if (!new RegExp(`User-agent: ${allowedBot}\\b`, "i").test(robotsText)) {
    errors.push(`robots.txt: falta el permiso explícito para ${allowedBot}`);
  }
}
for (const blockedBot of ["GPTBot", "ClaudeBot"]) {
  const groupPattern = new RegExp(
    `User-agent: ${blockedBot}\\s+Disallow: \\/(?:\\s|$)`,
    "i",
  );
  if (!groupPattern.test(robotsText)) {
    errors.push(`robots.txt: ${blockedBot} debe estar bloqueado para entrenamiento`);
  }
}
if (!/Sitemap:\s+https:\/\/lardevies\.com\/sitemap\.xml/i.test(robotsText)) {
  errors.push("robots.txt: sitemap ausente o incorrecto");
}

let vercelConfig;
try {
  vercelConfig = JSON.parse(
    fs.readFileSync(path.join(root, "vercel.json"), "utf8"),
  );
} catch (error) {
  errors.push(`vercel.json inválido (${error.message})`);
}
if (vercelConfig) {
  const noindexRules = (vercelConfig.headers || []).filter((rule) =>
    (rule.headers || []).some(
      (header) =>
        header.key?.toLowerCase() === "x-robots-tag" &&
        /noindex/i.test(header.value || ""),
    ),
  );
  for (const rule of noindexRules) {
    const previewOnly = (rule.has || []).some(
      (condition) =>
        condition.type === "host" && /vercel/i.test(String(condition.value || "")),
    );
    if (!previewOnly) {
      errors.push("vercel.json: X-Robots-Tag noindex no está limitado a previews");
    }
  }
  const redirects = vercelConfig.redirects || [];
  const ruralRedirect = redirects.find(
    (redirect) => redirect.source === "/otros-alojamientos/",
  );
  if (ruralRedirect?.destination !== "/rural-prado/" || ![301, 308].includes(ruralRedirect.statusCode || (ruralRedirect.permanent ? 308 : 0))) {
    errors.push("vercel.json: falta el 301 de /otros-alojamientos/ a /rural-prado/");
  }
  for (const retired of ["/excursiones-en-lugo/", "/blog/"]) {
    if (redirects.some((redirect) => redirect.source === retired)) {
      errors.push(`vercel.json: ${retired} no debe redirigirse a contenido no equivalente`);
    }
    const goneRoute = (vercelConfig.routes || []).some((route) => route.status === 410 && new RegExp(route.src).test(retired));
    if (!goneRoute) errors.push(`vercel.json: ${retired} debe responder 410`);
  }
  if ((vercelConfig.rewrites || []).length) errors.push("vercel.json: no debe reescribir URLs limpias a HTML legacy");
}

const htaccessPath = path.join(root, ".htaccess");
if (!fs.existsSync(htaccessPath)) {
  errors.push("Falta .htaccess para IONOS");
} else {
  const htaccess = fs.readFileSync(htaccessPath, "utf8");
  if (!/RewriteRule \^otros-alojamientos\/\?\$ \/rural-prado\/ \[R=301,L,NE\]/.test(htaccess)) {
    errors.push(".htaccess: falta el 301 de /otros-alojamientos/ a /rural-prado/");
  }
  if (!/RewriteRule \^rural-prado\/\?\$ OtrosAlojamientos\.html \[L\]/.test(htaccess)) {
    errors.push(".htaccess: falta la ruta canónica /rural-prado/");
  }
  if (!/RewriteRule \^zonas-comunes\/\?\$ zonas-comunes\.html \[L\]/.test(htaccess)) {
    errors.push(".htaccess: falta la ruta migrada /zonas-comunes/");
  }
  if (!/RewriteRule \^\(\?:excursiones-en-lugo\|blog\)\/\?\$ - \[G,L\]/.test(htaccess)) {
    errors.push(".htaccess: excursiones y blog deben responder 410");
  }
}

const buildStaticPath = path.join(root, "scripts", "build_static.js");
if (fs.existsSync(buildStaticPath)) {
  const buildStatic = fs.readFileSync(buildStaticPath, "utf8");
  if (!/require\(["']\.\.\/site\.config\.cjs["']\)/.test(buildStatic)) {
    errors.push(
      "scripts/build_static.js: el build no consume el manifiesto site.config.cjs",
    );
  }
}

console.log(`Páginas revisadas: ${htmlFiles.length}`);
console.log(`Errores: ${errors.length}`);
for (const error of errors) console.log(`ERROR: ${error}`);
console.log(`Avisos: ${warnings.length}`);
for (const warning of warnings) console.log(`AVISO: ${warning}`);

if (errors.length > 0) {
  process.exitCode = 1;
}
