"use strict";

const assert = require("node:assert/strict");
const { test, after } = require("node:test");
const handler = require("../../api/chat.js");
const { chatDeployConfig } = require("../../scripts/chat_deploy_config.cjs");
const saved = { NODE_ENV: process.env.NODE_ENV, RAG_ALLOWED_ORIGINS: process.env.RAG_ALLOWED_ORIGINS };
process.env.NODE_ENV = "production";
process.env.RAG_ALLOWED_ORIGINS = "https://lardevies.com,https://www.lardevies.com";
after(() => {
  for (const [key, value] of Object.entries(saved)) {
    if (value === undefined) delete process.env[key]; else process.env[key] = value;
  }
});

async function call(origin, method = "OPTIONS", extras = {}, body = {}) {
  const response = { headers: {}, setHeader(key, value) { this.headers[key] = value; }, end(body) { this.body = body; } };
  await handler({ method, headers: { host: "chat.lardevies.com", ...(origin === undefined ? {} : { origin }), ...extras }, body }, response);
  return response;
}

test("IONOS preflight authorizes only the explicit origin and JSON POST", async () => {
  for (const origin of ["https://lardevies.com", "https://www.lardevies.com"]) {
    const response = await call(origin, "OPTIONS", { "access-control-request-method": "POST", "access-control-request-headers": "content-type" });
    assert.equal(response.statusCode, 204);
    assert.equal(response.headers["Access-Control-Allow-Origin"], origin);
    assert.equal(response.headers["Access-Control-Allow-Headers"], "Content-Type");
    assert.equal(response.headers.Vary, "Origin");
  }
});

test("rejects foreign, malformed, local production and forged forwarded origins", async () => {
  for (const origin of ["https://evil.test", "https://lardevies.com.evil.test", "null", "http://localhost:4173", "https://lardevies.com/path", "http://chat.lardevies.com", "https://chat.lardevies.com:444"]) {
    for (const method of ["OPTIONS", "POST"]) {
      const response = await call(origin, method, { "x-forwarded-host": "evil.test" });
      assert.equal(response.statusCode, 403, origin);
      assert.equal(response.headers["Access-Control-Allow-Origin"], undefined);
    }
  }
});

test("rejects unsupported preflight methods and headers", async () => {
  for (const extras of [{ "access-control-request-method": "DELETE" }, { "access-control-request-headers": "Content-Type, Authorization" }]) {
    assert.equal((await call("https://lardevies.com", "OPTIONS", extras)).statusCode, 403);
  }
});

test("POST errors remain readable across origins and are never cached", async () => {
  const response = await call("https://lardevies.com", "POST");
  assert.equal(response.statusCode, 400);
  assert.equal(response.headers["Access-Control-Allow-Origin"], "https://lardevies.com");
  assert.equal(response.headers["Cache-Control"], "no-store");
});

test("same-origin and requests without Origin remain supported", async () => {
  for (const origin of ["https://chat.lardevies.com", undefined]) {
    assert.equal((await call(origin, "POST")).statusCode, 400);
  }
});

test("build defaults to same-origin and supports a base path", () => {
  assert.deepEqual(chatDeployConfig(), { endpoint: "/api/chat", origin: "" });
  assert.equal(chatDeployConfig("", "/preview/").endpoint, "/preview/api/chat");
  assert.deepEqual(chatDeployConfig("https://chat.lardevies.com/api/chat"), { endpoint: "https://chat.lardevies.com/api/chat", origin: "https://chat.lardevies.com" });
});

test("build rejects insecure or ambiguous external endpoints", () => {
  for (const value of ["http://chat.test/api/chat", "//chat.test/api/chat", "https://user:password@chat.test/api/chat", "https://chat.test/api/chat?key=secret", "https://chat.test/api/chat#fragment", "https://chat.test/wrong", "javascript:alert(1)"]) {
    assert.throws(() => chatDeployConfig(value), /CHAT_API_URL/);
  }
});
