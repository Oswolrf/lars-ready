import assert from "node:assert/strict";
import { test } from "node:test";
import { createEdgeHandler } from "../../supabase/functions/_shared/edge-handler.mjs";
import config from "../../scripts/chat_deploy_config.cjs";

const origin = "https://lardevies.com";
const endpoint = "https://example.supabase.co/functions/v1/chat";
const secrets = { SUPABASE_URL: "https://example.supabase.co", CHAT_DATABASE_KEY: "test-private-key", CHAT_HISTORY_SECRET: "a-long-test-secret-with-more-than-thirty-two-bytes", RAG_ALLOWED_ORIGINS: origin };
const req = (body, extras = {}) => new Request(endpoint, { method: "POST", headers: { Origin: origin, "Content-Type": "application/json", ...extras }, body: typeof body === "string" ? body : JSON.stringify(body) });

test("Supabase adapter preserves signed conversations and rejects abuse before AI", async (t) => {
  const savedFetch = globalThis.fetch;
  let calls = [];
  let rejectDaily = false;
  globalThis.fetch = async (url, options) => {
    assert.equal(url, "https://example.supabase.co/rest/v1/rpc/consume_chat_rate_limit");
    assert.equal(options.headers.apikey, "test-private-key");
    const body = JSON.parse(options.body);
    calls.push(body);
    return Response.json(!(rejectDaily && body.p_window_seconds === 86400));
  };
  const handler = createEdgeHandler(secrets);
  try {
    await t.test("preflight is public, exact-origin, and never queries the database", async () => {
      const r = await handler(new Request(endpoint, {method: "OPTIONS", headers: {Origin: origin, "Access-Control-Request-Method": "POST", "Access-Control-Request-Headers": "content-type"}}));
      assert.equal(r.status, 204);
      assert.equal(r.headers.get("Access-Control-Allow-Origin"), origin);
      assert.equal(calls.length, 0);
      const hosted = await handler(new Request("https://example.supabase.co/chat", {method:"OPTIONS",headers:{Origin:origin}}));
      assert.equal(hosted.status,204);
      assert.equal((await handler(new Request("https://example.supabase.co/chat/other", {headers:{Origin:origin}}))).status,404);
    });
    await t.test("fails closed for missing configuration, absent Origin, and foreign origins", async () => {
      assert.equal((await createEdgeHandler({...secrets, RAG_ALLOWED_ORIGINS:""})(req({message:"Hola"}))).status, 403);
      assert.equal((await handler(new Request(endpoint))).status, 403);
      assert.equal((await handler(req({message:"Hola"}, {Origin:"https://evil.test"}))).status, 403);
      assert.equal(calls.length, 0);
    });
    await t.test("bounded JSON parser rejects malformed and oversized bodies including chunked requests", async () => {
      assert.equal((await handler(req("{"))).status, 400);
      assert.equal((await handler(req({message:"Hola"}, {"Content-Type":"text/plain"}))).status, 415);
      assert.equal((await handler(req("x".repeat(17000)))).status, 413);
      const stream = new ReadableStream({start(c) { c.enqueue(new Uint8Array(17000)); c.close(); }});
      assert.equal((await handler(new Request(endpoint, {method:"POST",headers:{Origin:origin,"Content-Type":"application/json"},body:stream,duplex:"half"}))).status,413);
      assert.equal(calls.length, 0);
    });
    await t.test("signed multi-turn JSON contract is unchanged and secrets stay private", async () => {
      const r = await handler(req({message:"Hola"}), "127.0.0.1");
      assert.equal(r.status, 200);
      const first = await r.json();
      assert.match(first.answer, /Hola/);
      assert.ok(first.historyToken);
      assert.equal(calls.length, 3);
      const history = [{role:"user",content:"Hola"},{role:"assistant",content:first.answer}];
      assert.equal((await handler(req({message:"Gracias",history,historyToken:first.historyToken}))).status,200);
      history[1].content = "forged";
      assert.equal((await handler(req({message:"Gracias",history,historyToken:first.historyToken}))).status,400);
      assert.ok(!JSON.stringify(first).includes(secrets.CHAT_DATABASE_KEY));
    });
    await t.test("global daily cap survives changing client addresses and forged Vercel headers", async () => {
      calls = [];
      rejectDaily = true;
      for (const ip of ["1.2.3.4", "5.6.7.8"]) {
        const r = await handler(req({message:"Hola"}, {"x-forwarded-for":ip,"x-vercel-forwarded-for":"forged"}));
        assert.equal(r.status,429);
        assert.ok(r.headers.get("Retry-After"));
      }
      assert.equal(calls[2].p_identity_hash,calls[5].p_identity_hash);
      assert.equal(calls[2].p_max_requests,500);
    });
    await t.test("database failure prevents model calls", async () => {
      globalThis.fetch = async () => Response.json({}, {status:503});
      assert.equal((await handler(req({message:"Hola"}))).status,503);
    });
  } finally { globalThis.fetch = savedFetch; }
});

test("static build accepts the Supabase endpoint without accepting query secrets", () => {
  assert.deepEqual(config.chatDeployConfig(endpoint), {endpoint,origin:"https://example.supabase.co"});
  for (const bad of [endpoint+"?apikey=secret", endpoint+"/other", endpoint.replace("https:","http:")]) assert.throws(()=>config.chatDeployConfig(bad));
});
