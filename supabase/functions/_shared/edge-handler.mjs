import { createChatHandler } from "./chat-core.mjs";

const BODY_LIMIT = 16 * 1024;

async function readBody(request) {
  if (Number(request.headers.get("content-length")) > BODY_LIMIT) throw new RangeError("body_limit");
  if (!request.body) return "";
  const reader = request.body.getReader();
  const chunks = [];
  let size = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > BODY_LIMIT) {
        await reader.cancel();
        throw new RangeError("body_limit");
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  return new TextDecoder().decode(bytes);
}

export function createEdgeHandler(secrets) {
  const env = {
    ...secrets,
    NODE_ENV: "production",
    // Custom secret names cannot start with SUPABASE_. The URL is built in.
    SUPABASE_SECRET_KEY: secrets.CHAT_DATABASE_KEY || secrets.SUPABASE_SERVICE_ROLE_KEY,
  };
  const core = createChatHandler(env, { edge: true });
  const allowedOrigins = new Set(String(env.RAG_ALLOWED_ORIGINS || "").split(",").map((s) => s.trim()).filter(Boolean));
  return async function handle(request, remoteAddress = "unknown") {
    const origin = request.headers.get("origin");
    const headers = new Headers({ "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", "Vary": "Origin", "X-Content-Type-Options": "nosniff" });
    const json = (status, error) => new Response(JSON.stringify({ error }), { status, headers });
    // The hosted gateway strips /functions/v1 before invoking the function.
    if (!["/functions/v1/chat", "/chat"].includes(new URL(request.url).pathname)) return json(404, "not_found");
    // Fail closed if deployment omitted its allowlist. This isn't authentication:
    // non-browser callers can forge Origin, so the core enforces global quotas.
    if (!allowedOrigins.size || !origin || !allowedOrigins.has(origin)) return json(403, "origin_not_allowed");
    headers.set("Access-Control-Allow-Origin", origin);
    let body = "";
    if (request.method === "POST") {
      if (request.headers.get("content-type")?.split(";")[0].trim().toLowerCase() !== "application/json") return json(415, "unsupported_media_type");
      try { body = await readBody(request); }
      catch (error) { return json(error instanceof RangeError ? 413 : 400, error instanceof RangeError ? "payload_too_large" : "invalid_body"); }
    }
    // Ignore user-supplied Vercel headers. Use the nearest forwarded hop;
    // fall back conservatively to the runtime's peer (possibly a shared gateway).
    const forwarded = request.headers.get("x-forwarded-for")?.split(",").map((s) => s.trim()).filter(Boolean);
    const clientIdentity = forwarded?.at(-1) || remoteAddress;
    const coreHeaders = Object.fromEntries(request.headers.entries());
    delete coreHeaders["x-vercel-forwarded-for"];
    delete coreHeaders["x-forwarded-for"];
    let statusCode = 200;
    let responseBody;
    const response = {
      get statusCode() { return statusCode; },
      set statusCode(value) { statusCode = value; },
      setHeader(name, value) { headers.set(name, String(value)); },
      end(value) { responseBody = value; },
    };
    try {
      await core({ method: request.method, headers: coreHeaders, body, clientIdentity }, response);
      return new Response(statusCode === 204 ? null : responseBody, { status: statusCode, headers });
    } catch {
      return json(503, "chat_unavailable");
    }
  };
}
