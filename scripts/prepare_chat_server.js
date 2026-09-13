"use strict";

const fs = require("node:fs");
const path = require("node:path");
const root = path.resolve(__dirname, "..");
// Fixed, ignored output; never copy local secrets or Vercel account bindings.
const output = path.join(root, ".cache", "chat-server");
fs.mkdirSync(path.join(output, "api"), { recursive: true });
fs.mkdirSync(path.join(output, "public"), { recursive: true });
fs.copyFileSync(path.join(root, "api", "chat.js"), path.join(output, "api", "chat.js"));
fs.mkdirSync(path.join(output, "supabase", "functions", "_shared"), { recursive: true });
fs.copyFileSync(path.join(root, "supabase", "functions", "_shared", "chat-core.mjs"), path.join(output, "supabase", "functions", "_shared", "chat-core.mjs"));
const pkg = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
// Keep dependency metadata aligned with the lockfile; install only runtime packages.
delete pkg.scripts;
fs.writeFileSync(path.join(output, "package.json"), JSON.stringify(pkg, null, 2) + "\n");
fs.copyFileSync(path.join(root, "package-lock.json"), path.join(output, "package-lock.json"));
fs.writeFileSync(path.join(output, "public", ".gitkeep"), "");
fs.writeFileSync(path.join(output, "vercel.json"), JSON.stringify({
  "$schema": "https://openapi.vercel.sh/vercel.json",
  version: 2,
  framework: null,
  installCommand: "npm ci --omit=dev",
  buildCommand: "",
  outputDirectory: "public",
  functions: { "api/chat.js": { maxDuration: 60 } },
}, null, 2) + "\n");
fs.writeFileSync(path.join(output, ".vercelignore"), ".env*\nnode_modules\n");
console.log(`Servidor preparado en ${output}. No se han copiado secretos ni se ha desplegado.`);
