"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const cheerio = require("cheerio");

function validateLaunch(output, manifest) {
  if (!manifest.launch?.scheduled) return;
  const { launch, basePath } = manifest;
  const content = path.join(output, basePath.slice(1));
  const apache = fs.readFileSync(path.join(output, ".htaccess"), "utf8");
  assert.ok(apache.includes(`RewriteCond %{TIME} <${launch.apacheTime}`));
  assert.ok(apache.includes(`<If "%{TIME} >= '${launch.apacheTime}'">`));
  assert.ok(apache.includes('Header always set Cache-Control "no-store"'));
  assert.deepEqual(JSON.parse(fs.readFileSync(path.join(content, "__launch/status.json"))), { launched: true });
  assert.deepEqual(JSON.parse(fs.readFileSync(path.join(content, "__launch/waiting.json"))), { launched: false });
  for (const page of launch.cover.pages) {
    const file = path.join(content, "__prelaunch", page.route.slice(1), "index.html");
    const $ = cheerio.load(fs.readFileSync(file, "utf8"));
    assert.equal($("html").attr("lang"), page.locale);
    assert.match($("meta[name=robots]").attr("content"), /noindex/);
    assert.equal($("[data-countdown]").attr("data-launch-at"), launch.at);
    assert.equal($("[data-countdown]").attr("data-launch-target"), `${basePath}${page.route.slice(1)}`);
    assert.equal($("script").length, 1);
    assert.equal($("script").attr("src"), launch.cover.js);
    assert.equal($("nav, iframe, form, video").length, 0);
    assert.equal($("a").length, 2);
    assert.equal($(".countdown-units > div").length, 4);
    $("img[src], link[href], script[src]").each((_, element) => {
      const value = $(element).attr("src") || $(element).attr("href");
      assert.ok(value.startsWith(basePath));
      assert.ok(fs.existsSync(path.join(content, value.slice(basePath.length))), value);
    });
  }
  assert.ok(!fs.readFileSync(path.join(content, "__prelaunch/sitemap.xml"), "utf8").includes("<loc>"));
  console.log("Lanzamiento: contador, idiomas, portada noindex, recursos y reglas temporales de Apache verificados.");
}

module.exports = { validateLaunch };
