"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { once } = require("node:events");
const { playbackIsBlocked } = require("../js/hero-video-policy.cjs");
const { createStaticServer, parseByteRange } = require("./serve_static.js");

const workspace = path.resolve(__dirname, "..");
const output = path.resolve(workspace, process.argv[2] || "public");
const manifestPath = path.join(output, "build-manifest.json");

function validateVideoPolicy() {
  const allowed = [null, {}, { saveData: false, effectiveType: "4g" }];
  for (const connection of allowed) {
    assert.equal(playbackIsBlocked({ connection }), false, `conexión normal bloqueada: ${JSON.stringify(connection)}`);
  }

  const blocked = [
    { saveData: true, effectiveType: "4g" },
    { saveData: false, effectiveType: "slow-2g" },
    { saveData: false, effectiveType: "2g" },
    { saveData: false, effectiveType: "3g" },
    { saveData: false, effectiveType: "3G" },
  ];
  for (const connection of blocked) {
    assert.equal(playbackIsBlocked({ connection }), true, `conexión limitada permitida: ${JSON.stringify(connection)}`);
  }
  assert.equal(playbackIsBlocked({ reducedMotion: true, connection: { effectiveType: "4g" } }), true);

  assert.deepEqual(parseByteRange("bytes=0-1023", 4096), { start: 0, end: 1023 });
  assert.deepEqual(parseByteRange("bytes=-512", 4096), { start: 3584, end: 4095 });
  assert.deepEqual(parseByteRange("bytes=4000-", 4096), { start: 4000, end: 4095 });
  assert.equal(parseByteRange("bytes=4096-", 4096), null);
  assert.equal(parseByteRange("bytes=20-10", 4096), null);
}

async function validateHttpContract(manifest) {
  const server = createStaticServer(output);
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const { port } = server.address();
  const origin = `http://127.0.0.1:${port}`;

  try {
    const assetResponse = await fetch(`${origin}${manifest.css}`, { method: "HEAD" });
    assert.equal(assetResponse.status, 200, "el CSS publicado no responde 200");
    assert.match(assetResponse.headers.get("cache-control") || "", /max-age=31536000/);
    assert.match(assetResponse.headers.get("cache-control") || "", /immutable/);
    assert.equal(assetResponse.headers.get("accept-ranges"), "bytes");

    const compressedAsset = await fetch(`${origin}${manifest.css}`, {
      headers: { "Accept-Encoding": "br" },
    });
    assert.equal(compressedAsset.status, 200, "el CSS comprimido no responde 200");
    assert.equal(compressedAsset.headers.get("content-encoding"), "br");
    assert.match(compressedAsset.headers.get("vary") || "", /accept-encoding/i);
    await compressedAsset.arrayBuffer();

    const htmlResponse = await fetch(`${origin}${manifest.basePath}`, { method: "HEAD" });
    assert.equal(htmlResponse.status, 200, "la portada no responde 200");
    assert.equal(htmlResponse.headers.get("cache-control"), "no-cache");

    const publishedVideo = Object.values(manifest.videos || {})
      .flatMap((video) => Object.values(video.published || {}))
      .find((value) => /\.(?:mp4|webm)$/i.test(value));
    assert.ok(publishedVideo, "el manifiesto no contiene un vídeo publicado");

    const rangeResponse = await fetch(`${origin}${publishedVideo}`, {
      headers: { Range: "bytes=0-1023" },
    });
    assert.equal(rangeResponse.status, 206, "el vídeo no admite respuesta parcial 206");
    assert.match(rangeResponse.headers.get("content-range") || "", /^bytes 0-1023\/\d+$/);
    assert.equal(rangeResponse.headers.get("content-length"), "1024");
    assert.equal(rangeResponse.headers.get("accept-ranges"), "bytes");
    assert.match(rangeResponse.headers.get("cache-control") || "", /immutable/);
    assert.equal((await rangeResponse.arrayBuffer()).byteLength, 1024);

    const invalidRange = await fetch(`${origin}${publishedVideo}`, {
      headers: { Range: "bytes=999999999999-" },
    });
    assert.equal(invalidRange.status, 416, "un rango imposible debe devolver 416");
    assert.match(invalidRange.headers.get("content-range") || "", /^bytes \*\/\d+$/);
  } finally {
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
}

async function main() {
  assert.ok(fs.existsSync(manifestPath), `falta ${manifestPath}; ejecuta el build primero`);
  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  validateVideoPolicy();
  await validateHttpContract(manifest);
  console.log("Aceptación estática: política de vídeo, caché immutable y rangos HTTP 206/416 verificados.");
}

main().catch((error) => {
  console.error(error.stack || error.message);
  process.exitCode = 1;
});
