"use strict";

const fs = require("node:fs");
const http = require("node:http");
const path = require("node:path");
const zlib = require("node:zlib");
const config = require("../site.config.cjs");

const root = path.resolve(process.cwd(), process.argv[2] || "public");
const portArgument = process.argv.find((argument) => argument.startsWith("--port="));
const port = Number(portArgument?.split("=")[1] || process.env.PORT || 4173);

const mimeTypes = {
  ".avif": "image/avif", ".css": "text/css; charset=utf-8", ".gif": "image/gif",
  ".html": "text/html; charset=utf-8", ".ico": "image/x-icon", ".jpeg": "image/jpeg",
  ".jpg": "image/jpeg", ".js": "text/javascript; charset=utf-8", ".json": "application/json; charset=utf-8",
  ".mp4": "video/mp4", ".pdf": "application/pdf", ".png": "image/png", ".svg": "image/svg+xml",
  ".txt": "text/plain; charset=utf-8", ".webm": "video/webm", ".webp": "image/webp", ".woff2": "font/woff2",
  ".xml": "application/xml; charset=utf-8",
};

function compressionFor(request, contentType) {
  if (!/^(?:text\/|application\/(?:javascript|json|xml)|image\/svg\+xml)/i.test(contentType)) return null;
  const accepted = String(request.headers["accept-encoding"] || "").toLowerCase();
  if (/\bbr\b/.test(accepted)) return "br";
  if (/\bgzip\b/.test(accepted)) return "gzip";
  return null;
}

function parseByteRange(value, size) {
  const match = /^bytes=(\d*)-(\d*)$/.exec(value || "");
  if (!match || (!match[1] && !match[2])) return null;

  let start;
  let end;
  if (!match[1]) {
    const suffixLength = Number(match[2]);
    if (!Number.isSafeInteger(suffixLength) || suffixLength <= 0) return null;
    start = Math.max(size - suffixLength, 0);
    end = size - 1;
  } else {
    start = Number(match[1]);
    end = match[2] ? Math.min(Number(match[2]), size - 1) : size - 1;
  }

  if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start < 0 || start >= size || end < start) return null;
  return { start, end };
}

function safeFile(pathname, documentRoot = root) {
  const decoded = decodeURIComponent(pathname).replaceAll("\\", "/");
  const candidate = path.resolve(documentRoot, `.${decoded}`);
  if (candidate !== documentRoot && !candidate.startsWith(`${documentRoot}${path.sep}`)) return null;
  if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) return candidate;
  if (fs.existsSync(candidate) && fs.statSync(candidate).isDirectory()) {
    const index = path.join(candidate, "index.html");
    if (fs.existsSync(index)) return index;
  }
  const index = path.join(candidate, "index.html");
  if (fs.existsSync(index)) return index;
  return null;
}

function createStaticServer(documentRoot = root) {
  return http.createServer((request, response) => {
  const url = new URL(request.url, `http://${request.headers.host || "localhost"}`);
  const redirect = config.redirects.find((item) => item.from === url.pathname);
  if (redirect) {
    response.writeHead(redirect.status, { Location: redirect.to });
    response.end();
    return;
  }
  if (config.gone.includes(url.pathname)) {
    const body = fs.readFileSync(path.join(documentRoot, "410.html"));
    response.writeHead(410, { "Content-Type": "text/html; charset=utf-8", "Content-Length": body.length });
    response.end(request.method === "HEAD" ? undefined : body);
    return;
  }

  const resolvedFile = safeFile(url.pathname, documentRoot);
  const file = resolvedFile || path.join(documentRoot, "404.html");
  const status = fs.existsSync(file) && file.endsWith("404.html") && !resolvedFile ? 404 : 200;
  const stat = fs.statSync(file);
  const extension = path.extname(file).toLowerCase();
  const headers = {
    "Content-Type": mimeTypes[extension] || "application/octet-stream",
    "Accept-Ranges": "bytes",
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "Cache-Control": file.includes(`${path.sep}assets${path.sep}`) ? "public, max-age=31536000, immutable" : "no-cache",
  };

  const range = request.headers.range;
  if (range && /^video\//.test(headers["Content-Type"])) {
    const parsedRange = parseByteRange(range, stat.size);
    if (!parsedRange) {
      response.writeHead(416, { "Content-Range": `bytes */${stat.size}` });
      response.end();
      return;
    }
    const { start, end } = parsedRange;
    response.writeHead(206, { ...headers, "Content-Range": `bytes ${start}-${end}/${stat.size}`, "Content-Length": end - start + 1 });
    if (request.method === "HEAD") response.end();
    else fs.createReadStream(file, { start, end }).pipe(response);
    return;
  }

  const compression = compressionFor(request, headers["Content-Type"]);
  if (!compression) {
    response.writeHead(status, { ...headers, "Content-Length": stat.size });
    if (request.method === "HEAD") response.end();
    else fs.createReadStream(file).pipe(response);
    return;
  }

  response.writeHead(status, {
    ...headers,
    "Content-Encoding": compression,
    "Vary": "Accept-Encoding",
  });
  if (request.method === "HEAD") {
    response.end();
    return;
  }
  const compressor = compression === "br"
    ? zlib.createBrotliCompress({ params: { [zlib.constants.BROTLI_PARAM_QUALITY]: 5 } })
    : zlib.createGzip({ level: 6 });
  fs.createReadStream(file).pipe(compressor).pipe(response);
  });
}

if (require.main === module) {
  const server = createStaticServer(root);
  server.listen(port, "127.0.0.1", () => {
    console.log(`Lar de Víes disponible en http://127.0.0.1:${port}`);
  });
}

module.exports = { compressionFor, createStaticServer, parseByteRange, safeFile };
