"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const cheerio = require("cheerio");
const config = require("../site.config.cjs");

function validateMaintenance(output, expectedEnv) {
  const manifest = JSON.parse(fs.readFileSync(path.join(output, "build-manifest.json"), "utf8"));
  assert.equal(manifest.maintenance, true);
  if (expectedEnv) assert.equal(manifest.deployEnv, expectedEnv);
  const content = path.join(output, manifest.basePath.replace(/^\//, ""));
  const walk = (dir) => fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => entry.isDirectory() ? walk(path.join(dir, entry.name)) : [path.join(dir, entry.name)]);
  const allowed = Object.values(config.properties).map((property) => new URL(property.bookingUrl).pathname);
  for (const file of walk(content).filter((item) => item.endsWith(".html"))) {
    const $ = cheerio.load(fs.readFileSync(file, "utf8"));
    assert.match($("meta[name=robots]").attr("content"), /noindex/, file);
    assert.equal($("h1").length, 1, file);
    assert.equal($("summary").length, 1, file);
    assert.equal($("a").length, 2, file);
    assert.equal($("nav, script, iframe, form").length, 0, file);
    $("a").each((index, element) => {
      const url = new URL($(element).attr("href"));
      assert.equal(url.origin, "https://direct-book.com");
      assert.equal(url.pathname, allowed[index]);
      assert.equal(url.searchParams.get("locale"), $("html").attr("lang"));
    });
    $("img[src], link[href]").each((_, element) => {
      const value = $(element).attr("src") || $(element).attr("href");
      assert.ok(value.startsWith(manifest.basePath), value);
      assert.ok(fs.existsSync(path.join(content, value.slice(manifest.basePath.length))), value);
    });
  }
  for (const page of manifest.pages) assert.ok(fs.existsSync(path.join(content, page.route.slice(1), "index.html")), page.route);
  assert.ok(!fs.readFileSync(path.join(content, "sitemap.xml"), "utf8").includes("<loc>"));
  console.log("Prelanzamiento: rutas, idiomas, noindex, recursos y ambos motores de reserva verificados.");
}
module.exports = { validateMaintenance };
