"use strict";
const fs = require("node:fs");
const path = require("node:path");
const esbuild = require("esbuild");
const root = path.resolve(__dirname, "..");
const output = path.join(root, ".cache", "supabase-chat");
async function main() {
  fs.mkdirSync(output, {recursive: true});
  await esbuild.build({
    entryPoints: [path.join(root,"supabase/functions/chat/index.ts")],
    outfile: path.join(output,"index.ts"), bundle: true, format: "esm", platform: "neutral", target: "es2022",
    external: ["node:*"],
    plugins: [{name:"deno-npm",setup(build) {
      const pkg = require("../package.json");
      build.onResolve({filter:/^(ai|@ai-sdk\/openai)$/}, args => ({path:`npm:${args.path}@${pkg.dependencies[args.path]}`,external:true}));
    }}],
  });
  console.log(`Función autocontenida sin secretos: ${path.join(output,"index.ts")}`);
}
main().catch(() => { console.error("No se pudo preparar la función"); process.exitCode=1; });
