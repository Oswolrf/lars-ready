"use strict";

const fs = require("node:fs");
const path = require("node:path");
const config = require("../site.config.cjs");

const root = path.resolve(__dirname, "..");
const output = path.join(root, "public");
const required = [
  ".htaccess",
  "_headers",
  "_redirects",
  "deploy/nginx.conf.example",
  "deploy/vercel.json",
];

const errors = [];
const read = (relative) => {
  const target = path.join(output, ...relative.split("/"));
  if (!fs.existsSync(target)) {
    errors.push(`Falta public/${relative}; ejecuta npm run build primero`);
    return "";
  }
  return fs.readFileSync(target, "utf8");
};

for (const file of required) read(file);

const netlify = read("_redirects");
const netlifyHeaders = read("_headers");
const apache = read(".htaccess");
const nginx = read("deploy/nginx.conf.example");
const vercel = read("deploy/vercel.json");
const vercelConfig = vercel ? JSON.parse(vercel) : { redirects: [], routes: [], headers: [] };
const manifestText = read("build-manifest.json");
const manifest = manifestText ? JSON.parse(manifestText) : { basePath: "/" };
const goneDocument = manifest.basePath === "/"
  ? path.join(output, "410.html")
  : path.join(output, ...manifest.basePath.replace(/^\/+|\/+$/g, "").split("/"), "410.html");
if (!fs.existsSync(goneDocument)) errors.push(`Falta ${path.relative(root, goneDocument).replaceAll("\\", "/")}`);
const publicUrl = (value) => manifest.basePath === "/"
  ? value
  : `${manifest.basePath}${value.replace(/^\/+/, "")}`;
const assetPattern = manifest.basePath === "/" ? "/assets/*" : `${manifest.basePath}assets/*`;
const vercelAssetPattern = manifest.basePath === "/" ? "/assets/:path*" : `${manifest.basePath}assets/:path*`;
const rootVercelPath = path.join(root, "vercel.json");
const rootVercel = fs.existsSync(rootVercelPath) ? JSON.parse(fs.readFileSync(rootVercelPath, "utf8")) : null;
if (!rootVercel) errors.push("Falta vercel.json en la raíz del proyecto");
const headers = `${netlifyHeaders}\n${apache}\n${nginx}\n${vercel}`;

for (const { from, to, status } of config.redirects) {
  const generatedFrom = publicUrl(from);
  const generatedTo = publicUrl(to);
  if (!netlify.includes(`${generatedFrom} ${generatedTo} ${status}`)) errors.push(`_redirects no contiene ${generatedFrom} -> ${generatedTo}`);
  if (!apache.includes(generatedFrom) || !apache.includes(generatedTo)) errors.push(`.htaccess no contiene ${generatedFrom} -> ${generatedTo}`);
  if (!nginx.includes(generatedFrom) || !nginx.includes(generatedTo)) errors.push(`nginx no contiene ${generatedFrom} -> ${generatedTo}`);
  if (!vercelConfig.redirects.some((entry) => entry.source === generatedFrom && entry.destination === generatedTo && entry.statusCode === status)) errors.push(`Vercel no contiene ${generatedFrom} -> ${generatedTo}`);
  if (rootVercel && !rootVercel.redirects?.some((entry) => entry.source === from && entry.destination === to && entry.statusCode === status)) errors.push(`vercel.json raíz no contiene ${from} -> ${to}`);
}

for (const route of config.gone) {
  const generatedRoute = publicUrl(route);
  if (!netlify.includes(`${generatedRoute} ${publicUrl("/410.html")} 410`)) errors.push(`_redirects no devuelve 410 para ${generatedRoute}`);
  if (!apache.includes(`Redirect gone ${generatedRoute}`)) errors.push(`.htaccess no devuelve 410 para ${generatedRoute}`);
  if (!nginx.includes(`location = ${generatedRoute} { return 410; }`)) errors.push(`nginx no devuelve 410 para ${generatedRoute}`);
  const generatedGone = vercelConfig.routes.some((entry) => entry.status === 410 && new RegExp(entry.src).test(generatedRoute));
  const rootGone = rootVercel?.routes?.some((entry) => entry.status === 410 && new RegExp(entry.src).test(route));
  if (!generatedGone) errors.push(`Vercel no devuelve 410 para ${route}`);
  if (!rootGone) errors.push(`vercel.json raíz no devuelve 410 para ${route}`);
}

if (rootVercel?.rewrites?.length) errors.push("vercel.json raíz conserva rewrites a HTML legacy");
if (!rootVercel?.headers?.some((entry) => entry.source === "/assets/:path*" && entry.headers?.some((header) => header.value?.includes("immutable")))) {
  errors.push("vercel.json raíz no aplica caché immutable a /assets/*");
}

if (!netlifyHeaders.includes(`${assetPattern}\n  Cache-Control: public, max-age=31536000, immutable`)) {
  errors.push(`_headers no aplica caché immutable a ${assetPattern}`);
}
if (!/FilesMatch[^>]+(?:css|js|woff2)[^>]+>[\s\S]*?Cache-Control "public, max-age=31536000, immutable"/i.test(apache)) {
  errors.push(".htaccess no aplica caché immutable a activos versionados");
}
if (!apache.includes("AddOutputFilterByType DEFLATE")) errors.push(".htaccess no activa compresión de texto");
if (!nginx.includes("gzip on;") || !nginx.includes("gzip_types")) errors.push("Nginx no activa compresión de texto");
if (!/location ~\*[^\n]+[\s\S]*?max-age=31536000, immutable/i.test(nginx)) errors.push("Nginx no aplica caché immutable a activos versionados");
if (!vercelConfig.headers.some((entry) => entry.source === vercelAssetPattern && entry.headers?.some((header) => header.key === "Cache-Control" && header.value.includes("immutable")))) {
  errors.push(`Vercel no aplica caché immutable a ${vercelAssetPattern}`);
}

for (const [name, adapter] of [["_headers", netlifyHeaders], [".htaccess", apache], ["Nginx", nginx], ["Vercel", vercel]]) {
  if (!adapter.includes("Content-Security-Policy") || !adapter.includes("script-src-attr 'none'")) errors.push(`${name} no incluye la CSP común`);
  if (!adapter.includes("Strict-Transport-Security")) errors.push(`${name} no incluye HSTS`);
}
if (JSON.stringify(rootVercel || {}).toLowerCase().includes("x-robots-tag") || JSON.stringify(rootVercel || {}).toLowerCase().includes("noindex")) {
  errors.push("vercel.json raíz aplica noindex global");
}

for (const requirement of [
  "Content-Security-Policy",
  "script-src-attr 'none'",
  "Cross-Origin-Resource-Policy",
  "X-Permitted-Cross-Domain-Policies",
  "immutable",
]) {
  if (!headers.includes(requirement)) errors.push(`Los adaptadores no incluyen ${requirement}`);
}

if (errors.length) {
  console.error(errors.map((error) => `- ${error}`).join("\n"));
  process.exitCode = 1;
} else {
  console.log(`Adaptadores verificados: Apache, Netlify/Cloudflare, Nginx y Vercel (${config.redirects.length} redirecciones, ${config.gone.length} retiradas).`);
}
