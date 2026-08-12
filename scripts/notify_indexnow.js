"use strict";

const config = require("../site.config.cjs");

const dryRun = process.argv.includes("--dry-run");
const origin = (process.env.SITE_ORIGIN || config.site.defaultOrigin).replace(/\/$/, "");
const key = process.env.INDEXNOW_KEY;

if (!key || !/^[A-Za-z0-9-]{8,128}$/.test(key)) {
  console.error("Define INDEXNOW_KEY (8-128 caracteres alfanuméricos o guion) antes de notificar.");
  process.exit(1);
}
if (!origin.startsWith("https://")) {
  console.error("SITE_ORIGIN debe usar HTTPS.");
  process.exit(1);
}

const requested = process.argv.filter((argument) => argument.startsWith("--url=")).map((argument) => argument.slice(6));
const routes = requested.length ? requested : config.pages.filter((page) => page.indexable !== false).map((page) => page.route);
const urlList = routes.map((route) => new URL(route, `${origin}/`).href);
const payload = {
  host: new URL(origin).host,
  key,
  keyLocation: `${origin}/${key}.txt`,
  urlList,
};

if (dryRun) {
  console.log(JSON.stringify(payload, null, 2));
  process.exit(0);
}

fetch("https://api.indexnow.org/indexnow", {
  method: "POST",
  headers: { "content-type": "application/json; charset=utf-8" },
  body: JSON.stringify(payload),
}).then(async (response) => {
  if (!response.ok) throw new Error(`IndexNow respondió ${response.status}: ${await response.text()}`);
  console.log(`IndexNow aceptó ${urlList.length} URL de ${payload.host}`);
}).catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
