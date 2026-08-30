"use strict";

const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const cheerio = require("cheerio");
const esbuild = require("esbuild");
const nunjucks = require("nunjucks");
const sharp = require("sharp");
const config = require("../site.config.cjs");

const root = path.resolve(__dirname, "..");
const output = path.join(root, "public");
// Lives under node_modules/.cache so Vercel's build cache (which persists
// node_modules between deployments) keeps processed images warm; entries are
// content-hashed, so stale files are never reused.
const cacheRoot = path.join(root, "node_modules", ".cache", "lars-assets");
const args = new Map(process.argv.slice(2).map((argument) => {
  const [key, value = "true"] = argument.replace(/^--/, "").split("=");
  return [key, value];
}));
const deployEnv = args.get("env") || process.env.DEPLOY_ENV || "production";
const siteOrigin = (process.env.SITE_ORIGIN || config.site.defaultOrigin).replace(/\/$/, "");
const basePath = normalizeBasePath(process.env.BASE_PATH || "/");
const isPreview = deployEnv !== "production";
const contentSecurityPolicy = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  "script-src 'self' https://sibforms.com",
  "script-src-attr 'none'",
  "style-src 'self' 'unsafe-inline'",
  "font-src 'self' data:",
  "img-src 'self' data: https://maps.gstatic.com https://maps.googleapis.com",
  "media-src 'self'",
  "frame-src https://maps.google.com https://www.google.com",
  "connect-src 'self' https://sibforms.com https://*.sibforms.com",
  "form-action 'self' https://*.sibforms.com https://direct-book.com",
  "upgrade-insecure-requests",
].join("; ");

if (!new Set(["production", "preview"]).has(deployEnv)) {
  throw new Error(`DEPLOY_ENV no válido: ${deployEnv}`);
}
if (deployEnv === "production" && !siteOrigin.startsWith("https://")) {
  throw new Error("SITE_ORIGIN debe usar HTTPS en producción");
}
if (path.dirname(output) !== root || path.basename(output) !== "public") {
  throw new Error(`Directorio de salida no seguro: ${output}`);
}

const templates = nunjucks.configure(path.join(root, "src", "templates"), {
  autoescape: true,
  noCache: true,
  throwOnUndefined: true,
});

const navigation = [
  { id: "inicio", label: "Inicio", route: "/" },
  { id: "casona", label: "La Casona", route: "/la-casona/" },
  { id: "villas", label: "Las Villas", route: "/las-villas-casitas-independientes/" },
  { id: "rural", label: "Rural Prado", route: "/rural-prado/" },
  { id: "entorno", label: "Entorno", route: "/el-entorno/" },
  { id: "nosotros", label: "Sobre nosotros", route: "/sobre-nosotros/" },
];

const sourceRoute = new Map(config.pages.map((page) => [normalizeSlashes(page.source), page.route]));
const redirectRoute = new Map(config.redirects.map((redirect) => [redirect.from, redirect.to]));
const responsiveCache = new Map();
let inlineSiteCss = "";
const referencedFiles = new Set([
  "favicon.ico",
  "apple-touch-icon.png",
]);
const usedIcons = new Set();

function normalizeBasePath(value) {
  if (!value || value === "/") return "/";
  return `/${value.replace(/^\/+|\/+$/g, "")}/`;
}

function normalizeSlashes(value) {
  return value.replaceAll("\\", "/").replace(/^\.\//, "");
}

function hash(buffer, length = 12) {
  return crypto.createHash("sha256").update(buffer).digest("hex").slice(0, length);
}

function ensureDirectory(directory) {
  fs.mkdirSync(directory, { recursive: true });
}

function writeFile(relativePath, contents) {
  const target = path.join(output, ...normalizeSlashes(relativePath).split("/"));
  ensureDirectory(path.dirname(target));
  fs.writeFileSync(target, contents);
  return target;
}

function copyFile(relativePath, destinationPath = relativePath) {
  const normalized = normalizeSlashes(relativePath).replace(/^\//, "");
  const source = path.join(root, ...normalized.split("/"));
  if (!fs.existsSync(source) || !fs.statSync(source).isFile()) {
    throw new Error(`Falta el activo referenciado: ${normalized}`);
  }
  const destination = path.join(output, ...normalizeSlashes(destinationPath).replace(/^\//, "").split("/"));
  ensureDirectory(path.dirname(destination));
  fs.copyFileSync(source, destination);
}

function publicUrl(value) {
  if (!value) return value;
  if (/^(?:https?:|mailto:|tel:|data:|blob:|#|\/\/)/i.test(value)) return value;
  const suffix = value.startsWith("/") ? value.slice(1) : value;
  return basePath === "/" ? `/${suffix}` : `${basePath}${suffix}`;
}

function canonicalUrl(route) {
  const pathname = publicUrl(route);
  return `${siteOrigin}${pathname}`;
}

function render(template, page = {}, extra = {}) {
  return templates.render(template, {
    page,
    site: config.site,
    properties: config.properties,
    navigation,
    deployEnv,
    url: publicUrl,
    ...extra,
  });
}

function upsertMeta($, selector, attributes) {
  let element = $(selector).first();
  if (!element.length) {
    element = $("<meta>");
    $("head").append(element);
  }
  for (const [name, value] of Object.entries(attributes)) element.attr(name, value);
}

function upsertLink($, selector, attributes) {
  let element = $(selector).first();
  if (!element.length) {
    element = $("<link>");
    $("head").append(element);
  }
  for (const [name, value] of Object.entries(attributes)) element.attr(name, value);
}

function resolveSourcePath(page, value) {
  const raw = value.split(/[?#]/, 1)[0];
  if (!raw || /^(?:https?:|mailto:|tel:|data:|blob:|#|\/\/)/i.test(raw)) return null;
  const withoutBase = basePath !== "/" && raw.startsWith(basePath) ? raw.slice(basePath.length) : raw.replace(/^\//, "");
  if (!withoutBase) return null;
  const decoded = decodeURIComponent(withoutBase);
  if (value.startsWith("/") || (basePath !== "/" && value.startsWith(basePath))) return normalizeSlashes(decoded);
  return normalizeSlashes(path.posix.normalize(path.posix.join(path.posix.dirname(normalizeSlashes(page.source)), decoded)));
}

function routeForLocalLink(page, value) {
  if (!value || /^(?:https?:|mailto:|tel:|data:|blob:|#|\/\/)/i.test(value)) return value;
  const [pathname, suffix = ""] = value.split(/(?=[?#])/);
  let normalized;
  if (pathname.startsWith("/")) {
    normalized = basePath !== "/" && pathname.startsWith(basePath)
      ? `/${pathname.slice(basePath.length)}`
      : pathname;
  } else {
    normalized = `/${normalizeSlashes(path.posix.normalize(path.posix.join(path.posix.dirname(normalizeSlashes(page.source)), pathname)))}`;
  }
  const withoutLeading = normalized.replace(/^\//, "");
  const cleanRoute = sourceRoute.get(withoutLeading) || redirectRoute.get(normalized) || normalized;
  return publicUrl(`${cleanRoute}${suffix}`);
}

function normalizeUrlAttributes($, page) {
  $("a[href]").each((_, element) => {
    const anchor = $(element);
    const href = anchor.attr("href");
    if (!href) return;
    if (href.includes("direct-book.com")) {
      if (!anchor.closest("#elegir-alojamiento").length && !anchor.is("[data-booking-property]")) {
        anchor.attr("href", publicUrl(config.site.bookingFallback)).attr("data-booking-trigger", "");
      }
      return;
    }
    anchor.attr("href", routeForLocalLink(page, href));
  });

  $("[data-sticky-cta-url]").attr("data-sticky-cta-url", publicUrl(config.site.bookingFallback));
  $(`a[href="${publicUrl(config.site.bookingFallback)}"]`).attr("data-booking-trigger", "");

  $("link[href]").each((_, element) => {
    const node = $(element);
    const value = node.attr("href");
    if (!value || /^(?:https?:|data:|blob:|#|\/\/)/i.test(value)) return;
    const sourcePath = resolveSourcePath(page, value);
    if (sourcePath && /\.[a-z0-9]{2,5}$/i.test(sourcePath)) node.attr("href", publicUrl(`/${sourcePath}`));
  });

  for (const attribute of ["src", "poster", "data-src"]) {
    $(`[${attribute}]`).each((_, element) => {
      const node = $(element);
      const value = node.attr(attribute);
      if (!value || /^(?:https?:|data:|blob:|\/\/)/i.test(value)) return;
      const sourcePath = resolveSourcePath(page, value);
      if (!sourcePath) return;
      node.attr(attribute, publicUrl(`/${sourcePath}`));
    });
  }

  $("[srcset], [data-srcset]").each((_, element) => {
    const node = $(element);
    for (const attribute of ["srcset", "data-srcset"]) {
      const value = node.attr(attribute);
      if (!value) continue;
      const normalized = value.split(",").map((candidate) => {
        const [candidateUrl, descriptor] = candidate.trim().split(/\s+/, 2);
        const sourcePath = resolveSourcePath(page, candidateUrl);
        if (!sourcePath) return candidate.trim();
        return `${publicUrl(`/${sourcePath}`)}${descriptor ? ` ${descriptor}` : ""}`;
      }).join(", ");
      node.attr(attribute, normalized);
    }
  });
}

function applyMetadata($, page) {
  const robots = isPreview
    ? "noindex, nofollow, noarchive"
    : page.indexable === false
      ? "noindex, follow"
      : "index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1";
  $("title").first().text(page.title);
  upsertMeta($, 'meta[name="description"]', { name: "description", content: page.description });
  upsertMeta($, 'meta[name="robots"]', { name: "robots", content: robots });
  upsertLink($, 'link[rel="canonical"]', { rel: "canonical", href: canonicalUrl(page.route) });
  upsertMeta($, 'meta[property="og:title"]', { property: "og:title", content: page.ogTitle || page.title });
  upsertMeta($, 'meta[property="og:description"]', { property: "og:description", content: page.description });
  upsertMeta($, 'meta[property="og:type"]', { property: "og:type", content: "website" });
  upsertMeta($, 'meta[property="og:url"]', { property: "og:url", content: canonicalUrl(page.route) });
  upsertMeta($, 'meta[property="og:image"]', { property: "og:image", content: `${siteOrigin}${publicUrl(page.image)}` });
  upsertMeta($, 'meta[property="og:image:alt"]', { property: "og:image:alt", content: page.imageAlt });
  upsertMeta($, 'meta[property="og:locale"]', { property: "og:locale", content: config.site.locale });
  upsertMeta($, 'meta[property="og:site_name"]', { property: "og:site_name", content: config.site.name });
  upsertMeta($, 'meta[name="twitter:card"]', { name: "twitter:card", content: "summary_large_image" });
  upsertMeta($, 'meta[name="twitter:title"]', { name: "twitter:title", content: page.ogTitle || page.title });
  upsertMeta($, 'meta[name="twitter:description"]', { name: "twitter:description", content: page.description });
  upsertMeta($, 'meta[name="twitter:image"]', { name: "twitter:image", content: `${siteOrigin}${publicUrl(page.image)}` });
  upsertMeta($, 'meta[name="twitter:image:alt"]', { name: "twitter:image:alt", content: page.imageAlt });
  referencedFiles.add(decodeURIComponent(page.image.replace(/^\//, "")));

  applyStructuredData($, page);
}

function applyStructuredData($, page) {
  const websiteId = `${siteOrigin}${publicUrl("/#website")}`;
  const larId = `${siteOrigin}${publicUrl("/#lar-de-vies")}`;
  const ruralId = `${siteOrigin}${publicUrl("/rural-prado/#rural-prado")}`;
  const pageUrl = canonicalUrl(page.route);
  const graph = [
    {
      "@type": "WebSite",
      "@id": websiteId,
      url: `${siteOrigin}${publicUrl("/")}`,
      name: config.site.name,
      inLanguage: config.site.language,
    },
  ];

  if (page.entity === "larDeVies") {
    graph.push({
      "@type": "LodgingBusiness",
      "@id": larId,
      name: config.properties.larDeVies.name,
      url: `${siteOrigin}${publicUrl("/")}`,
      image: `${siteOrigin}${publicUrl(page.image)}`,
      telephone: "+34678655303",
      email: "reservas@lardevies.com",
      address: {
        "@type": "PostalAddress",
        streetAddress: "Neipín, 4",
        addressLocality: "A Pontenova",
        addressRegion: "Lugo",
        postalCode: "27721",
        addressCountry: "ES",
      },
      sameAs: [
        "https://www.instagram.com/lardevies",
        "https://www.facebook.com/lardevies/",
        "https://www.youtube.com/channel/UCJQMiPWLy8OtIGr9uP7gvxA/videos",
      ],
    });
  }

  if (page.entity === "ruralPrado") {
    graph.push({
      "@type": "LodgingBusiness",
      "@id": ruralId,
      name: config.properties.ruralPrado.name,
      url: pageUrl,
      image: `${siteOrigin}${publicUrl(page.image)}`,
      potentialAction: {
        "@type": "ReserveAction",
        target: config.properties.ruralPrado.bookingUrl,
      },
    });
  }

  const webPage = {
    "@type": page.source === "sobre-nosotros.html" ? "AboutPage" : "WebPage",
    "@id": `${pageUrl}#webpage`,
    url: pageUrl,
    name: page.title,
    description: page.description,
    inLanguage: config.site.language,
    isPartOf: { "@id": websiteId },
    primaryImageOfPage: { "@type": "ImageObject", url: `${siteOrigin}${publicUrl(page.image)}` },
  };
  if (page.entity === "ruralPrado") webPage.mainEntity = { "@id": ruralId };
  else if (page.entity === "larDeVies") webPage.about = { "@id": larId };
  if (page.source === "Entorno.html") {
    webPage.about = {
      "@type": "TouristDestination",
      name: "Reserva de la Biosfera Río Eo, Oscos y Terras de Burón",
      sameAs: "https://www.miteco.gob.es/es/parques-nacionales-oapn/reservas-biosfera-mab/programa-mab-espana/nuestras-reservas-de-la-biosfera/rioeooscosterrasburon.html",
    };
  }
  if (page.source === "Reserva.html") {
    webPage.potentialAction = {
      "@type": "ReserveAction",
      target: [config.properties.larDeVies.bookingUrl, config.properties.ruralPrado.bookingUrl],
    };
  }
  graph.push(webPage);

  if (/^(?:suites|villas)\//.test(page.source)) {
    graph.push({
      "@type": "Accommodation",
      "@id": `${pageUrl}#accommodation`,
      name: (page.ogTitle || page.title).split("|")[0].trim(),
      url: pageUrl,
      image: `${siteOrigin}${publicUrl(page.image)}`,
      containedInPlace: { "@id": larId },
      mainEntityOfPage: { "@id": `${pageUrl}#webpage` },
    });
  }

  if (page.route !== "/") {
    const items = [{ "@type": "ListItem", position: 1, name: "Inicio", item: `${siteOrigin}${publicUrl("/")}` }];
    if (page.source.startsWith("suites/")) items.push({ "@type": "ListItem", position: 2, name: "La Casona", item: canonicalUrl("/la-casona/") });
    if (page.source.startsWith("villas/")) items.push({ "@type": "ListItem", position: 2, name: "Las Villas", item: canonicalUrl("/las-villas-casitas-independientes/") });
    items.push({ "@type": "ListItem", position: items.length + 1, name: (page.ogTitle || page.title).split("|")[0].trim(), item: pageUrl });
    graph.push({ "@type": "BreadcrumbList", "@id": `${pageUrl}#breadcrumbs`, itemListElement: items });
  }

  $('script[type="application/ld+json"]').remove();
  $("head").append(`<script type="application/ld+json">${JSON.stringify({ "@context": "https://schema.org", "@graph": graph }).replaceAll("</", "<\\/")}</script>`);
}

function replaceSharedComponents($, page) {
  $("noscript").remove();
  $(".skip-link, a[href=\"#main-content\"].sr-only").remove();
  $("body").prepend('<a class="skip-link" href="#main-content">Saltar al contenido</a>');
  $("nav#main-nav").first().replaceWith(render("partials/navigation.njk", page));
  $("#mobile-menu").remove();
  $("footer").first().replaceWith(render("partials/footer.njk", page));
  $("#booking-dialog, #booking-modal, [data-booking-dialog]").remove();
  $("body").append(render("partials/booking-dialog.njk", page));
  $("[data-chat-widget]").remove();
  $("body").append(render("partials/chat-widget.njk", page));
  if (!$("main#main-content").length) {
    const main = $("main").first();
    if (main.length) main.attr("id", "main-content");
  }
  if (!$("#back-to-top").length) {
    $("body").append('<button id="back-to-top" type="button" class="fixed bottom-5 right-5 z-30 flex h-12 w-12 items-center justify-center rounded-full border border-stone-200 bg-white/80 opacity-0 shadow-md backdrop-blur transition-opacity pointer-events-none" aria-hidden="true" tabindex="-1" aria-label="Volver arriba"><span aria-hidden="true">↑</span></button>');
  }
}

function replaceScriptsAndStyles($, cssUrl, jsUrl) {
  $('link[rel="preconnect"][href*="fonts."], link[href*="fonts.googleapis.com"], link[href*="fonts.gstatic.com"]').remove();
  $('link[rel="stylesheet"]').remove();
  if (inlineSiteCss) $("head").append(`<style data-site-css>${inlineSiteCss}</style>`);
  else $("head").append(`<link rel="stylesheet" href="${cssUrl}">`);
  $("script[src]").remove();
  $("body").append(`<script type="module" src="${jsUrl}"></script>`);
}

function stripAnimationOpacity(style) {
  if (!style) return style;
  return style
    .replace(/(?:^|;)\s*opacity\s*:[^;]+;?/gi, ";")
    .replace(/(?:^|;)\s*animation\s*:[^;]+;?/gi, ";")
    .replace(/(?:^|;)\s*transition(?:-[a-z-]+)?\s*:[^;]+;?/gi, ";")
    .replace(/^;+|;+$/g, "");
}

function normalizeCriticalHero($) {
  const hero = $("main header").first();
  if (!hero.length) return;
  hero.find("h1.font-display").each((_, element) => {
    const heading = $(element);
    if (!heading.find(".italic").length) heading.addClass("font-hero");
  });
  hero.add(hero.find("*")).each((_, element) => {
    const node = $(element);
    if (node.is("video")) return;
    const normalizedStyle = stripAnimationOpacity(node.attr("style"));
    if (normalizedStyle) node.attr("style", normalizedStyle);
    else node.removeAttr("style");
    node.removeClass("animate-fade-in animate-on-scroll");
    if (node.hasClass("opacity-0")) node.removeClass("opacity-0").addClass("opacity-100");
  });
}

async function applyHero($, page) {
  if (!page.hero) return;
  $('link[rel="preload"][as="image"]').remove();
  const videoConfig = config.heroVideos[page.hero];
  const video = $("video[data-hero-video]").first();
  if (!video.length || !videoConfig) return;
  const selected = videoConfig[videoConfig.selected];
  if (!selected) throw new Error(`Variante de vídeo desconocida en ${page.source}: ${videoConfig.selected}`);

  const posterMobile = publicUrl(videoConfig.poster.mobile);
  const posterDesktop = publicUrl(videoConfig.poster.desktop);
  const mobileResponsive = await createResponsiveVariants(videoConfig.poster.mobile.replace(/^\//, ""), "hero");
  const desktopResponsive = await createResponsiveVariants(videoConfig.poster.desktop.replace(/^\//, ""), "hero");
  const variantSet = (responsive, format, fallback) => responsive?.variants
    ? responsive.variants[format].map((variant) => `${variant.url} ${variant.width}w`).join(", ")
    : fallback;
  const mobileAvif = variantSet(mobileResponsive, "avif", posterMobile);
  const mobileWebp = variantSet(mobileResponsive, "webp", posterMobile);
  const desktopAvif = variantSet(desktopResponsive, "avif", posterDesktop);
  const desktopWebp = variantSet(desktopResponsive, "webp", posterDesktop);
  video.attr({
    preload: "none",
    "data-hero-video": "",
    "aria-hidden": "true",
  });
  video.removeAttr("poster");
  video.attr("data-hero-reveal-at", String(videoConfig.revealAt ?? 0));
  const normalizedStyle = stripAnimationOpacity(video.attr("style"));
  if (normalizedStyle) video.attr("style", normalizedStyle);
  else video.removeAttr("style");
  video.addClass("hero-video");
  video.find("source").remove();
  video.append(`<source data-src="${publicUrl(selected.webm)}" type="video/webm">`);
  video.append(`<source data-src="${publicUrl(selected.mp4)}" type="video/mp4">`);
  video.before(`<picture class="hero-poster" aria-hidden="true"><source type="image/avif" media="(max-width: 767px)" srcset="${mobileAvif}" sizes="100vw"><source type="image/webp" media="(max-width: 767px)" srcset="${mobileWebp}" sizes="100vw"><source type="image/avif" media="(min-width: 768px)" srcset="${desktopAvif}" sizes="100vw"><source type="image/webp" media="(min-width: 768px)" srcset="${desktopWebp}" sizes="100vw"><img src="${posterDesktop}" alt="" fetchpriority="high" decoding="async"></picture>`);
  $("head").append(`<link rel="preload" as="image" type="image/avif" imagesrcset="${mobileAvif}" imagesizes="100vw" media="(max-width: 767px)" fetchpriority="high">`);
  $("head").append(`<link rel="preload" as="image" type="image/avif" imagesrcset="${desktopAvif}" imagesizes="100vw" media="(min-width: 768px)" fetchpriority="high">`);
  for (const asset of [videoConfig.poster.mobile, videoConfig.poster.desktop, selected.webm, selected.mp4]) {
    referencedFiles.add(decodeURIComponent(asset.replace(/^\//, "")));
  }
}

function transformMaterialIcons($) {
  $(".material-symbols-outlined").each((_, element) => {
    const node = $(element);
    const icon = node.text().trim();
    if (!/^[a-z0-9_]+$/.test(icon)) return;
    usedIcons.add(icon);
    const classes = (node.attr("class") || "").split(/\s+/).filter((name) => name && name !== "material-symbols-outlined");
    classes.unshift("material-icon");
    const title = node.attr("title");
    const accessibleName = node.attr("aria-label");
    const aria = accessibleName ? `role="img" aria-label="${accessibleName}"` : 'aria-hidden="true"';
    const titleMarkup = title ? `<title>${title}</title>` : "";
    node.replaceWith(`<svg class="${classes.join(" ")}" ${aria} focusable="false"><use href="__ICON_SPRITE__#${icon}"></use>${titleMarkup}</svg>`);
  });
}

function localFileFromPublicUrl(value) {
  if (!value || /^(?:https?:|data:|blob:|\/\/)/i.test(value)) return null;
  let pathname = value.split(/[?#]/, 1)[0];
  if (basePath !== "/" && pathname.startsWith(basePath)) pathname = pathname.slice(basePath.length);
  pathname = pathname.replace(/^\//, "");
  if (!pathname || pathname.startsWith("assets/")) return null;
  return decodeURIComponent(pathname);
}

async function createResponsiveVariants(sourceRelative, profile = "content") {
  const normalized = normalizeSlashes(sourceRelative);
  const cacheKey = `${normalized}:${profile}`;
  if (responsiveCache.has(cacheKey)) return responsiveCache.get(cacheKey);
  const promise = (async () => {
    const source = path.join(root, ...normalized.split("/"));
    if (!fs.existsSync(source) || !/\.(?:avif|jpe?g|png|webp)$/i.test(source)) return null;
    const image = sharp(source, { failOn: "none" });
    const metadata = await image.metadata();
    if (!metadata.width || !metadata.height) return null;
    const isBrandAsset = /(?:logo|favicon|apple-touch)/i.test(normalized);
    if (metadata.width < (isBrandAsset ? 160 : 320)) return { width: metadata.width, height: metadata.height, variants: null };
    const sourceHash = hash(fs.readFileSync(source), 10);
    const requestedWidths = isBrandAsset
      ? [80, 160, 320, 640]
      : profile === "hero"
      ? [480, 768, 1280, 1920]
      : profile === "gallery"
        ? [160, 320, 768, 1280]
        : [320, 480, 768, 1280];
    const maximum = requestedWidths.at(-1);
    const widths = [...new Set([
      ...requestedWidths,
      ...(metadata.width < maximum ? [metadata.width] : []),
    ].filter((width) => width <= metadata.width))].sort((a, b) => a - b);
    const stem = path.basename(normalized, path.extname(normalized)).normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").toLowerCase();
    const variants = { avif: [], webp: [] };
    for (const width of widths) {
      for (const format of ["avif", "webp"]) {
        const encoderProfile = profile === "hero" ? "-hero-v2" : "";
        const filename = `${stem}-${sourceHash}${encoderProfile}-${width}.${format}`;
        const cacheFile = path.join(cacheRoot, filename);
        const outputFile = path.join(output, "assets", "images", filename);
        ensureDirectory(path.dirname(cacheFile));
        ensureDirectory(path.dirname(outputFile));
        if (!fs.existsSync(cacheFile)) {
          const pipeline = sharp(source, { failOn: "none" }).resize({ width, withoutEnlargement: true });
          const buffer = format === "avif"
            ? await pipeline.avif({ quality: profile === "hero" ? 40 : 52, effort: 4 }).toBuffer()
            : await pipeline.webp({ quality: profile === "hero" ? 72 : 78, effort: 4 }).toBuffer();
          fs.writeFileSync(cacheFile, buffer);
        }
        fs.copyFileSync(cacheFile, outputFile);
        variants[format].push({ width, url: publicUrl(`/assets/images/${filename}`) });
      }
    }
    return { width: metadata.width, height: metadata.height, variants };
  })();
  responsiveCache.set(cacheKey, promise);
  return promise;
}

async function enhanceImages($, page) {
  const images = $("img").toArray();
  for (const element of images) {
    const image = $(element);
    const sourceRelative = localFileFromPublicUrl(image.attr("src"));
    if (!sourceRelative) continue;
    referencedFiles.add(sourceRelative);
    const inHero = image.closest("header, .hero-viewport, [data-hero]").length > 0 || image.attr("fetchpriority") === "high";
    const inGallery = image.closest("[data-carousel], [data-gallery], [data-gallery-open], [data-lightbox]").length > 0;
    const responsive = await createResponsiveVariants(sourceRelative, inHero ? "hero" : inGallery ? "gallery" : "content");
    if (!responsive) continue;
    image.attr({ width: String(responsive.width), height: String(responsive.height), decoding: image.attr("decoding") || "async" });
    const inCriticalChrome = image.closest("nav#main-nav").length > 0;
    if (!inHero && !inCriticalChrome && !image.attr("loading")) image.attr("loading", "lazy");
    if (inCriticalChrome && !image.attr("loading")) image.attr("loading", "eager");
    if (!responsive.variants || image.parent().is("picture")) continue;
    const isBrandAsset = /(?:logo|favicon|apple-touch)/i.test(sourceRelative);
    const isCarouselThumbnail = image.closest("[data-carousel-slide]").length > 0;
    const sizes = image.attr("sizes") || (isCarouselThumbnail
      ? "80px"
      : isBrandAsset && image.closest("nav#main-nav").length
      ? "(max-width: 767px) 80px, 96px"
      : isBrandAsset && image.closest("footer").length
        ? "(max-width: 767px) calc(100vw - 48px), 18rem"
        : isBrandAsset && inHero
          ? "(max-width: 767px) 240px, min(27vw, 512px)"
          : inHero
            ? "100vw"
      : "(max-width: 767px) 100vw, (max-width: 1279px) 50vw, 33vw");
    const avif = responsive.variants.avif.map((variant) => `${variant.url} ${variant.width}w`).join(", ");
    const webp = responsive.variants.webp.map((variant) => `${variant.url} ${variant.width}w`).join(", ");
    if (inHero && !$('link[rel="preload"][as="image"]').length) {
      const fallback = responsive.variants.avif.at(-1)?.url;
      if (fallback) {
        $("head").append(`<link rel="preload" as="image" type="image/avif" href="${fallback}" imagesrcset="${avif}" imagesizes="${sizes}" fetchpriority="high">`);
      }
    }
    image.attr({ srcset: webp, sizes });
    image.wrap("<picture></picture>");
    image.before(`<source type="image/avif" srcset="${avif}" sizes="${sizes}">`);
    image.before(`<source type="image/webp" srcset="${webp}" sizes="${sizes}">`);
    if (inCriticalChrome) image.attr("fetchpriority", "high");
  }
}

function deferCarouselImages($) {
  const transparentPixel = "data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs=";
  const candidate = (srcset, preferredWidth) => {
    const entries = String(srcset || "").split(",").map((entry) => entry.trim()).filter(Boolean);
    const exact = entries.find((entry) => new RegExp(`\\s${preferredWidth}w$`).test(entry));
    return exact || entries[0] || "";
  };

  const deferPicture = (container, previewWidth = null) => {
    container.find("source[srcset]").each((__, sourceElement) => {
      const source = $(sourceElement);
      const fullSrcset = source.attr("srcset");
      source.attr("data-srcset", fullSrcset);
      if (previewWidth) source.attr("srcset", candidate(fullSrcset, previewWidth));
      else source.removeAttr("srcset");
    });
    container.find("img").each((__, imageElement) => {
      const image = $(imageElement);
      const fullSrcset = image.attr("srcset");
      const originalSource = image.attr("src");
      if (originalSource) image.attr("data-src", originalSource);
      if (fullSrcset) image.attr("data-srcset", fullSrcset);
      if (previewWidth && fullSrcset) {
        const preview = candidate(fullSrcset, previewWidth);
        image.attr("srcset", preview);
        image.attr("src", preview.split(/\s+/, 1)[0]);
      } else {
        image.attr("src", transparentPixel);
        image.removeAttr("srcset");
      }
    });
  };

  $("[data-carousel]").each((_, carouselElement) => {
    const carousel = $(carouselElement);
    const track = carousel.find("[data-carousel-track]").first();
    const slides = track.children().toArray();
    if (slides.length < 2) return;
    const controls = carousel.find("[data-carousel-slide]").toArray();
    const selected = controls.findIndex((control) => $(control).attr("aria-current") === "true");
    const currentIndex = selected >= 0 ? selected : 0;
    carousel.attr("data-carousel-preload", "adjacent");

    const fallbackPicture = $(slides[currentIndex]).find("picture").first().clone();
    fallbackPicture.find("source[srcset]").each((__, sourceElement) => {
      const source = $(sourceElement);
      source.attr("srcset", candidate(source.attr("srcset"), 320));
      source.removeAttr("data-srcset");
    });
    fallbackPicture.find("img").each((__, imageElement) => {
      const image = $(imageElement);
      const preview = candidate(image.attr("srcset"), 320);
      if (preview) {
        image.attr("srcset", preview);
        image.attr("src", preview.split(/\s+/, 1)[0]);
      }
      image.removeAttr("data-src data-srcset");
      image.attr("loading", "lazy");
    });
    if (fallbackPicture.length) {
      carousel.after(`<noscript><div class="carousel-no-js">${$.html(fallbackPicture)}</div></noscript>`);
    }

    slides.forEach((slide, index) => {
      deferPicture($(slide));
    });
    controls.forEach((control) => {
      deferPicture($(control));
    });
  });
}

async function buildFonts() {
  const specs = [
    ["@fontsource/inter/files/inter-latin-300-normal.woff2", "inter-latin-300-normal.woff2"],
    ["@fontsource/inter/files/inter-latin-400-normal.woff2", "inter-latin-400-normal.woff2"],
    ["@fontsource/inter/files/inter-latin-500-normal.woff2", "inter-latin-500-normal.woff2"],
    ["@fontsource/inter/files/inter-latin-600-normal.woff2", "inter-latin-600-normal.woff2"],
    ["@fontsource/lora/files/lora-latin-400-normal.woff2", "lora-latin-400-normal.woff2"],
    ["@fontsource/lora/files/lora-latin-600-normal.woff2", "lora-latin-600-normal.woff2"],
    ["@fontsource/lora/files/lora-latin-700-normal.woff2", "lora-latin-700-normal.woff2"],
    ["@fontsource/lora/files/lora-latin-400-italic.woff2", "lora-latin-400-italic.woff2"],
  ];
  const heroSubset = fs.readFileSync(path.join(root, "assets", "generated", "fonts", "lora-latin-400-hero.woff2"));
  const heroFontFace = `@font-face{font-family:"Lora Hero";font-style:normal;font-display:optional;font-weight:400;src:url("data:font/woff2;base64,${heroSubset.toString("base64")}") format("woff2")}`;
  let fontCss = `${heroFontFace}\n${fs.readFileSync(path.join(root, "src", "fonts.css"), "utf8")}`;
  for (const [modulePath, publicName] of specs) {
    const source = require.resolve(modulePath, { paths: [root] });
    const criticalSubset = path.join(root, "assets", "generated", "fonts", "lora-latin-400-critical.woff2");
    const buffer = fs.readFileSync(publicName === "lora-latin-400-normal.woff2" ? criticalSubset : source);
    if (publicName === "lora-latin-400-normal.woff2") {
      const inlineUrl = `data:font/woff2;base64,${buffer.toString("base64")}`;
      fontCss = fontCss.replaceAll(`/assets/fonts/${publicName}`, inlineUrl);
      continue;
    }
    const extension = path.extname(publicName);
    const stem = path.basename(publicName, extension);
    const hashedName = `${stem}-${hash(buffer)}${extension}`;
    writeFile(`assets/fonts/${hashedName}`, buffer);
    fontCss = fontCss.replaceAll(publicName, hashedName);
  }
  return fontCss;
}

async function buildCss() {
  const fontCss = await buildFonts();
  const cssFiles = [
    path.join(root, "dist", "output.css"),
    ...fs.readdirSync(path.join(root, "css")).filter((file) => file.endsWith(".css")).sort().map((file) => path.join(root, "css", file)),
  ];
  let source = [fontCss, ".material-icon{display:inline-block;width:1em;height:1em;fill:currentColor;vertical-align:-.125em;flex:none}.skip-link{position:fixed;left:1rem;top:1rem;z-index:100;transform:translateY(-200%);background:#fff;color:#172019;padding:.75rem 1rem;border-radius:.5rem}.skip-link:focus{transform:none}", ...cssFiles.map((file) => fs.readFileSync(file, "utf8"))].join("\n");
  source = source.replaceAll(".material-symbols-outlined", ".material-icon");
  if (basePath !== "/") {
    source = source.replace(/url\((['"]?)\/(assets|images|videos)\//g, (_, quote, directory) => `url(${quote}${basePath}${directory}/`);
  }
  addReferencesFromText(source);
  const result = await esbuild.transform(source, { loader: "css", minify: true, target: "es2020" });
  inlineSiteCss = result.code;
  const filename = `site-${hash(result.code)}.css`;
  writeFile(`assets/css/${filename}`, result.code);
  return publicUrl(`/assets/css/${filename}`);
}

async function buildJs() {
  const result = await esbuild.build({
    entryPoints: [path.join(root, "src", "site-entry.js")],
    bundle: true,
    format: "esm",
    minify: true,
    target: ["es2020"],
    charset: "utf8",
    write: false,
    legalComments: "none",
    define: {
      __LAR_BASE_PATH__: JSON.stringify(basePath),
      __LAR_BOOKING_FALLBACK__: JSON.stringify(publicUrl(config.site.bookingFallback)),
    },
  });
  const javascript = result.outputFiles.find((file) => file.path.endsWith(".js")) || result.outputFiles[0];
  if (!javascript) throw new Error("esbuild no generó el bundle JavaScript");
  addReferencesFromText(javascript.text);
  const filename = `site-${hash(javascript.contents)}.js`;
  writeFile(`assets/js/${filename}`, javascript.contents);
  return publicUrl(`/assets/js/${filename}`);
}

function findMaterialIcon(icon) {
  const aliases = {
    expand_less: "keyboard_arrow_up",
    expand_more: "keyboard_arrow_down",
  };
  const filename = aliases[icon] || icon;
  const candidates = [
    path.join(root, "node_modules", "@material-symbols", "svg-400", "outlined", `${filename}.svg`),
    path.join(root, "node_modules", "@material-symbols", "svg-400", "rounded", `${filename}.svg`),
  ];
  return candidates.find((candidate) => fs.existsSync(candidate));
}

function buildIconSprite() {
  const symbols = [];
  const missing = [];
  for (const icon of [...usedIcons].sort()) {
    const source = findMaterialIcon(icon);
    if (!source) {
      missing.push(icon);
      symbols.push(`<symbol id="${icon}" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="1.5"></circle><path d="M8 12h8" fill="none" stroke="currentColor" stroke-width="1.5"></path></symbol>`);
      continue;
    }
    const svg = fs.readFileSync(source, "utf8");
    const viewBox = svg.match(/viewBox="([^"]+)"/)?.[1] || "0 0 24 24";
    const contents = svg.replace(/^.*?<svg[^>]*>/s, "").replace(/<\/svg>.*$/s, "");
    symbols.push(`<symbol id="${icon}" viewBox="${viewBox}">${contents}</symbol>`);
  }
  const sprite = `<svg xmlns="http://www.w3.org/2000/svg">${symbols.join("")}</svg>`;
  const filename = `material-symbols-${hash(sprite)}.svg`;
  writeFile(`assets/icons/${filename}`, sprite);
  if (missing.length) throw new Error(`Iconos sin SVG local (${missing.length}): ${missing.join(", ")}`);
  return publicUrl(`/assets/icons/${filename}`);
}

function addReferencesFromText(text) {
  const candidates = [
    ...text.matchAll(/["'`](\/?(?:[^/"'`?#]+\/)*(?:assets\/generated|images|videos)\/[^"'`?#]+)["'`]/g),
    ...text.matchAll(/url\(\s*["']?(\/?(?:[^/"')?#]+\/)*(?:assets\/generated|images|videos)\/[^"')?#]+)/g),
  ];
  for (const match of candidates) {
    let value = match[1];
    if (basePath !== "/" && value.startsWith(basePath)) value = value.slice(basePath.length);
    const relative = decodeURIComponent(value.replace(/^\//, ""));
    if (!relative.includes("${") && /^(?:assets\/generated|images|videos)\//.test(relative)) {
      referencedFiles.add(normalizeSlashes(relative));
    }
  }
}

function relativeFromBuiltUrl(value) {
  let pathname = value;
  if (basePath !== "/" && pathname.startsWith(basePath)) pathname = pathname.slice(basePath.length);
  return pathname.replace(/^\//, "");
}

async function copyReferencedFiles() {
  const assetMap = new Map();
  const thumbnailMap = new Map();
  for (const file of [...referencedFiles].sort()) {
    if (file.startsWith("assets/") && !file.startsWith("assets/generated/")) continue;
    const extension = path.extname(file).toLowerCase();
    if (![".avif", ".gif", ".ico", ".jpeg", ".jpg", ".mp4", ".pdf", ".png", ".svg", ".webm", ".webp"].includes(extension)) continue;
    const source = path.join(root, ...normalizeSlashes(file).split("/"));
    if (!fs.existsSync(source) || !fs.statSync(source).isFile()) throw new Error(`Falta el activo referenciado: ${file}`);
    if ([".jpeg", ".jpg"].includes(extension)) {
      const responsive = await createResponsiveVariants(file, "gallery");
      if (responsive?.variants?.webp?.length) {
        const full = responsive.variants.webp.at(-1);
        const thumbnail = responsive.variants.webp.filter((variant) => variant.width <= 320).at(-1) || responsive.variants.webp[0];
        assetMap.set(normalizeSlashes(file), relativeFromBuiltUrl(full.url));
        thumbnailMap.set(normalizeSlashes(file), relativeFromBuiltUrl(thumbnail.url));
        continue;
      }
    }
    const buffer = fs.readFileSync(source);
    const stem = path.basename(file, extension).normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").toLowerCase() || "asset";
    const destination = `assets/media/${stem}-${hash(buffer)}${extension}`;
    copyFile(file, destination);
    assetMap.set(normalizeSlashes(file), destination);
  }
  return { assetMap, thumbnailMap };
}

function rewritePublishedAssetUrls(assetMap, thumbnailMap) {
  const textExtensions = new Set([".css", ".html", ".js", ".json", ".xml"]);
  for (const target of walkFiles(output).filter((file) => textExtensions.has(path.extname(file).toLowerCase()))) {
    let contents = fs.readFileSync(target, "utf8");
    for (const [source, destination] of thumbnailMap) {
      const destinationUrl = publicUrl(`/${destination}`);
      for (const candidate of new Set([`thumb:${source}`, encodeURI(`thumb:${source}`)])) {
        contents = contents.replaceAll(candidate, destinationUrl);
      }
    }
    for (const [source, destination] of assetMap) {
      const sourceUrl = publicUrl(`/${source}`);
      const destinationUrl = publicUrl(`/${destination}`);
      for (const candidate of new Set([sourceUrl, encodeURI(sourceUrl), source, encodeURI(source)])) {
        contents = contents.replaceAll(candidate, destinationUrl);
      }
    }
    fs.writeFileSync(target, contents);
  }
}

function outputPathForRoute(route) {
  if (route === "/") return "index.html";
  return `${route.replace(/^\/+|\/+$/g, "")}/index.html`;
}

async function buildPage(page, cssUrl, jsUrl) {
  const sourcePath = path.join(root, ...normalizeSlashes(page.source).split("/"));
  if (!fs.existsSync(sourcePath)) throw new Error(`Falta la página fuente: ${page.source}`);
  const sourceHtml = fs.readFileSync(sourcePath, "utf8");
  const $ = cheerio.load(sourceHtml, { decodeEntities: false });
  $("base").remove();
  applyMetadata($, page);
  replaceSharedComponents($, page);
  normalizeUrlAttributes($, page);
  $('link[rel="preload"][as="image"]').remove();
  await applyHero($, page);
  normalizeCriticalHero($);
  transformMaterialIcons($);
  await enhanceImages($, page);
  deferCarouselImages($);
  replaceScriptsAndStyles($, cssUrl, jsUrl);
  $("html").attr({ lang: "es", "data-base-path": basePath, "data-deploy-env": deployEnv }).addClass("no-js");
  const document = $.html()
    .replaceAll(config.site.defaultOrigin, siteOrigin)
    .replaceAll(".material-symbols-outlined", ".material-icon");
  addReferencesFromText(document);
  writeFile(outputPathForRoute(page.route), document);
}

function buildSpecialPages(cssUrl, jsUrl) {
  for (const special of config.specialPages) {
    const source = path.join(root, special.source);
    if (!fs.existsSync(source)) throw new Error(`Falta la página especial: ${special.source}`);
    const $ = cheerio.load(fs.readFileSync(source, "utf8"), { decodeEntities: false });
    upsertMeta($, 'meta[name="robots"]', { name: "robots", content: "noindex, nofollow, noarchive" });
    $("link[rel=canonical]").remove();
    replaceScriptsAndStyles($, cssUrl, jsUrl);
    normalizeUrlAttributes($, { source: special.source });
    transformMaterialIcons($);
    const document = $.html();
    addReferencesFromText(document);
    writeFile(special.output, document);
  }
}

function buildRedirectFallbacks(cssUrl) {
  for (const redirect of config.redirects) {
    const target = canonicalUrl(redirect.to);
    const document = `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="robots" content="noindex,follow"><link rel="canonical" href="${target}"><meta http-equiv="refresh" content="0;url=${target}"><title>Redirigiendo…</title></head><body><p>Esta página se ha movido a <a href="${target}">${target}</a>.</p></body></html>`;
    const relative = redirect.from.endsWith(".html")
      ? redirect.from.replace(/^\//, "")
      : outputPathForRoute(redirect.from);
    if (!fs.existsSync(path.join(output, relative))) writeFile(relative, document);
  }
  for (const route of config.gone) {
    writeFile(outputPathForRoute(route), render("gone.njk", {}, { cssUrl }));
  }
}

function buildSitemapAndRobots() {
  const urls = config.pages.filter((page) => page.indexable !== false).map((page) => `  <url>\n    <loc>${canonicalUrl(page.route)}</loc>\n    <lastmod>${page.lastModified}</lastmod>\n  </url>`).join("\n");
  writeFile("sitemap.xml", `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`);
  const robots = isPreview
    ? `User-agent: *\nAllow: /\n\nSitemap: ${siteOrigin}${publicUrl("/sitemap.xml")}\n`
    : `User-agent: OAI-SearchBot\nAllow: /\n\nUser-agent: ChatGPT-User\nAllow: /\n\nUser-agent: Claude-SearchBot\nAllow: /\n\nUser-agent: Claude-User\nAllow: /\n\nUser-agent: PerplexityBot\nAllow: /\n\nUser-agent: Perplexity-User\nAllow: /\n\nUser-agent: GPTBot\nDisallow: /\n\nUser-agent: ClaudeBot\nDisallow: /\n\nUser-agent: *\nAllow: /\n\nSitemap: ${siteOrigin}${publicUrl("/sitemap.xml")}\n`;
  writeFile("robots.txt", robots);
  if (process.env.INDEXNOW_KEY) {
    if (!/^[A-Za-z0-9-]{8,128}$/.test(process.env.INDEXNOW_KEY)) throw new Error("INDEXNOW_KEY no tiene un formato válido");
    writeFile(`${process.env.INDEXNOW_KEY}.txt`, process.env.INDEXNOW_KEY);
  }
}

function buildAdapters(cssUrl) {
  const redirects = config.redirects.map((item) => `${publicUrl(item.from)} ${publicUrl(item.to)} ${item.status}`).join("\n");
  const gone = config.gone.map((route) => `${publicUrl(route)} ${publicUrl("/410.html")} 410`).join("\n");
  const catchAll = basePath === "/" ? "/*" : `${basePath}*`;
  writeFile("_redirects", `${redirects}\n${gone}\n${catchAll} ${publicUrl("/404.html")} 404\n`);
  const sharedHeaders = [
    "Strict-Transport-Security: max-age=31536000; includeSubDomains",
    `Content-Security-Policy: ${contentSecurityPolicy}`,
    "X-Frame-Options: DENY",
    "X-Content-Type-Options: nosniff",
    "Referrer-Policy: strict-origin-when-cross-origin",
    "Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=(), usb=()",
    "Cross-Origin-Opener-Policy: same-origin",
    "Cross-Origin-Resource-Policy: same-site",
    "X-Permitted-Cross-Domain-Policies: none",
  ];
  writeFile("_headers", `${publicUrl("/assets/*")}\n  Cache-Control: public, max-age=31536000, immutable\n${publicUrl("/*.html")}\n  Cache-Control: public, max-age=0, must-revalidate\n${catchAll}\n${sharedHeaders.map((header) => `  ${header}`).join("\n")}\n`);
  const apacheRedirects = config.redirects.map((item) => `Redirect ${item.status} ${publicUrl(item.from)} ${publicUrl(item.to)}`).join("\n");
  const apacheGone = config.gone.map((route) => `Redirect gone ${publicUrl(route)}`).join("\n");
  writeFile(".htaccess", `Options -Indexes -MultiViews\nDirectoryIndex index.html\nErrorDocument 404 ${publicUrl("/404.html")}\nErrorDocument 410 ${publicUrl("/410.html")}\n${apacheRedirects}\n${apacheGone}\n<IfModule mod_deflate.c>\n  AddOutputFilterByType DEFLATE text/html text/plain text/css application/javascript application/json application/xml image/svg+xml\n</IfModule>\n<IfModule mod_headers.c>\n  Header always set Strict-Transport-Security "max-age=31536000; includeSubDomains"\n  Header always set Content-Security-Policy "${contentSecurityPolicy}"\n  Header always set X-Frame-Options "DENY"\n  Header always set X-Content-Type-Options "nosniff"\n  Header always set Referrer-Policy "strict-origin-when-cross-origin"\n  Header always set Permissions-Policy "camera=(), microphone=(), geolocation=(), payment=(), usb=()"\n  Header always set Cross-Origin-Opener-Policy "same-origin"\n  Header always set Cross-Origin-Resource-Policy "same-site"\n  Header always set X-Permitted-Cross-Domain-Policies "none"\n  <FilesMatch "\\.(?:css|js|woff2|avif|webp|png|jpe?g|svg|mp4|webm)$">\n    Header set Cache-Control "public, max-age=31536000, immutable"\n  </FilesMatch>\n  <FilesMatch "\\.html$">\n    Header set Cache-Control "public, max-age=0, must-revalidate"\n  </FilesMatch>\n</IfModule>\n`);
  const nginxRedirects = config.redirects.map((item) => `location = ${publicUrl(item.from)} { return ${item.status} ${publicUrl(item.to)}; }`).join("\n");
  const nginxGone = config.gone.map((route) => `location = ${publicUrl(route)} { return 410; }`).join("\n");
  writeFile("deploy/nginx.conf.example", `# Si BASE_PATH no es '/', monte este directorio public en ${basePath}\ngzip on;\ngzip_vary on;\ngzip_types text/plain text/css application/javascript application/json application/xml image/svg+xml;\nadd_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;\nadd_header Content-Security-Policy "${contentSecurityPolicy}" always;\nadd_header X-Frame-Options "DENY" always;\nadd_header X-Content-Type-Options "nosniff" always;\nadd_header Referrer-Policy "strict-origin-when-cross-origin" always;\nadd_header Permissions-Policy "camera=(), microphone=(), geolocation=(), payment=(), usb=()" always;\nadd_header Cross-Origin-Opener-Policy "same-origin" always;\nadd_header Cross-Origin-Resource-Policy "same-site" always;\nadd_header X-Permitted-Cross-Domain-Policies "none" always;\nerror_page 410 ${publicUrl("/410.html")};\nlocation ${basePath} { try_files $uri $uri/ $uri/index.html =404; }\n${nginxRedirects}\n${nginxGone}\nlocation ~* \\.(?:css|js|woff2|avif|webp|png|jpe?g|svg|mp4|webm)$ { expires 1y; add_header Cache-Control "public, max-age=31536000, immutable"; }\n`);
  const vercelAdapter = {
    $schema: "https://openapi.vercel.sh/vercel.json",
    version: 2,
    trailingSlash: true,
    redirects: config.redirects.map((item) => ({ source: publicUrl(item.from), destination: publicUrl(item.to), statusCode: item.status })),
    routes: config.gone.map((route) => ({ src: `^${publicUrl(route).replaceAll("/", "\\/").replace(/\\\/$/, "\\/?")}$`, dest: publicUrl("/410.html"), status: 410 })),
    headers: [
      { source: publicUrl("/assets/:path*"), headers: [{ key: "Cache-Control", value: "public, max-age=31536000, immutable" }] },
      { source: publicUrl("/:path*"), headers: sharedHeaders.map((header) => { const index = header.indexOf(":"); return { key: header.slice(0, index), value: header.slice(index + 1).trim() }; }) },
    ],
  };
  writeFile("deploy/vercel.json", `${JSON.stringify(vercelAdapter, null, 2)}\n`);
  writeFile("410.html", render("gone.njk", {}, { cssUrl }));
}

function writeBuildManifest(cssUrl, jsUrl, iconUrl, assetMap) {
  const videos = {};
  for (const [name, video] of Object.entries(config.heroVideos)) {
    // Original exports are local authoring inputs and are intentionally omitted
    // from Vercel. Their approved hashes live in manifest-v3.json; the deploy
    // manifest only needs stable source metadata plus the published derivatives.
    const originals = Object.fromEntries(Object.entries(video.original).map(([format, source]) => [format, { source }]));
    const published = Object.fromEntries(Object.entries(video[video.selected]).map(([format, source]) => {
      const relative = source.replace(/^\//, "");
      return [format, publicUrl(`/${assetMap.get(relative) || relative}`)];
    }));
    videos[name] = { selected: video.selected, originals, published };
  }
  writeFile("build-manifest.json", `${JSON.stringify({ deployEnv, siteOrigin, basePath, css: cssUrl, js: jsUrl, icons: iconUrl, pages: config.pages.map(({ source, route, lastModified }) => ({ source, route, lastModified })), videos }, null, 2)}\n`);
}

function nestBuildForBasePath() {
  if (basePath === "/") return;
  const mountName = basePath.replace(/^\/+|\/+$/g, "");
  if (!mountName || mountName.includes("..") || mountName.includes("\\")) throw new Error(`BASE_PATH no seguro: ${basePath}`);
  const mountRoot = path.join(output, ...mountName.split("/"));
  ensureDirectory(mountRoot);
  const controls = new Set([".htaccess", "_headers", "_redirects", "build-manifest.json", "deploy", "robots.txt", mountName.split("/")[0]]);
  for (const entry of fs.readdirSync(output, { withFileTypes: true })) {
    if (controls.has(entry.name)) continue;
    fs.renameSync(path.join(output, entry.name), path.join(mountRoot, entry.name));
  }
  fs.copyFileSync(path.join(output, "robots.txt"), path.join(mountRoot, "robots.txt"));
}

async function main() {
  fs.rmSync(output, { recursive: true, force: true });
  ensureDirectory(output);
  ensureDirectory(cacheRoot);
  const [cssUrl, jsUrl] = await Promise.all([buildCss(), buildJs()]);
  for (const page of config.pages) await buildPage(page, cssUrl, jsUrl);
  buildSpecialPages(cssUrl, jsUrl);
  const iconUrl = buildIconSprite();
  for (const htmlFile of walkFiles(output).filter((file) => file.endsWith(".html"))) {
    const document = fs.readFileSync(htmlFile, "utf8").replaceAll("__ICON_SPRITE__", iconUrl);
    fs.writeFileSync(htmlFile, document);
  }
  buildRedirectFallbacks(cssUrl);
  buildSitemapAndRobots();
  buildAdapters(cssUrl);
  const { assetMap, thumbnailMap } = await copyReferencedFiles();
  rewritePublishedAssetUrls(assetMap, thumbnailMap);
  writeBuildManifest(cssUrl, jsUrl, iconUrl, assetMap);
  nestBuildForBasePath();
  console.log(`Paquete estático ${deployEnv} preparado en ${output}`);
  console.log(`Rutas: ${config.pages.length}; iconos: ${usedIcons.size}; activos fuente: ${referencedFiles.size}`);
}

function walkFiles(directory) {
  if (!fs.existsSync(directory)) return [];
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const candidate = path.join(directory, entry.name);
    return entry.isDirectory() ? walkFiles(candidate) : [candidate];
  });
}

main().catch((error) => {
  console.error(error.stack || error.message || error);
  process.exitCode = 1;
});
