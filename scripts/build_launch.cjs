"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { buildMaintenance } = require("./build_maintenance.cjs");

function escapePattern(value) { return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }

function apacheLaunchRules({ launch, basePath }) {
  const prefix = escapePattern(basePath.slice(1));
  const before = `RewriteCond %{TIME} <${launch.apacheTime}`;
  const rules = [
    `# Scheduled launch; Apache local time zone: ${launch.serverTimeZone}`,
    "RewriteEngine On",
    before,
    `RewriteRule ^${prefix}__launch/status\\.json$ ${basePath}__launch/waiting.json [END]`,
    before,
    `RewriteRule ^${prefix}(robots\\.txt|sitemap\\.xml)$ ${basePath}__prelaunch/$1 [END]`,
    // The assets and internal covers must remain available during rewrites.
    `RewriteRule ^${prefix}(?:assets/maintenance/|__prelaunch/|__launch/|favicon\\.ico$|apple-touch-icon\\.png$) - [END]`,
    before,
    `RewriteCond %{DOCUMENT_ROOT}${basePath}__prelaunch/$1 -f`,
    `RewriteRule ^${prefix}(.*)$ ${basePath}__prelaunch/$1 [END]`,
    before,
    `RewriteCond %{DOCUMENT_ROOT}${basePath}__prelaunch/$1/index.html -f`,
    `RewriteRule ^${prefix}(.*?)/?$ ${basePath}__prelaunch/$1/index.html [END]`,
    before,
    `RewriteRule ^${prefix}(en|de)(?:/.*)?$ ${basePath}__prelaunch/$1/index.html [END]`,
    before,
    `RewriteRule ^${prefix}.*$ ${basePath}__prelaunch/index.html [END]`,
  ];
  return `${rules.join("\n")}\n`;
}

function apacheLaunchHeaders({ launch, basePath }) {
  return `<IfModule mod_headers.c>
  <If "%{TIME} < '${launch.apacheTime}' || %{REQUEST_URI} == '${basePath}__launch/status.json'">
    Header unset Cache-Control
    Header always set Cache-Control "no-store"
  </If>
  Header always set X-Launch-Server-Time "expr=%{TIME}"
</IfModule>\n`;
}

function buildScheduledLaunch(options) {
  const cover = buildMaintenance({ ...options, pagePrefix: "__prelaunch/", writeControls: false });
  const directory = path.join(options.output, "__launch");
  fs.mkdirSync(directory, { recursive: true });
  fs.writeFileSync(path.join(directory, "status.json"), JSON.stringify({ launched: true }));
  fs.writeFileSync(path.join(directory, "waiting.json"), JSON.stringify({ launched: false }));
  const manifestPath = path.join(options.output, "build-manifest.json");
  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  manifest.launch = { ...options.launch, cover };
  fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
}

module.exports = { apacheLaunchRules, apacheLaunchHeaders, buildScheduledLaunch };
