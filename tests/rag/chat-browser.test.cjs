"use strict";

const assert = require("node:assert/strict");
const { test } = require("node:test");
const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const nunjucks = require("nunjucks");
const { chromium } = require("@playwright/test");
const handler = require("../../api/chat.js");
const { createEdgeHandler } = require("../../supabase/functions/_shared/edge-handler.mjs");
const root = path.resolve(__dirname, "../..");

for (const runtime of ["node", "supabase"]) test(`${runtime}: real browser widget completes a signed cross-origin conversation and displays connection failure`, async () => {
  const savedFetch = global.fetch;
  const names = ["NODE_ENV", "CHAT_HISTORY_SECRET", "SUPABASE_URL", "SUPABASE_SECRET_KEY", "RAG_ALLOWED_ORIGINS"];
  const saved = Object.fromEntries(names.map((name) => [name, process.env[name]]));
  Object.assign(process.env, { NODE_ENV: "production", CHAT_HISTORY_SECRET: "browser-test-secret-with-at-least-32-bytes", SUPABASE_URL: "https://supabase.test", SUPABASE_SECRET_KEY: "test" });
  global.fetch = async (url) => {
    assert.match(String(url), /\/rest\/v1\/rpc\/consume_chat_rate_limit$/);
    return { ok: true, json: async () => true };
  };
  let preflights = 0;
  let browser;
  let edge;
  const api = http.createServer(async (request, response) => {
    if (request.method === "OPTIONS") preflights++;
    let body = "";
    for await (const chunk of request) body += chunk;
    if (runtime === "supabase") {
      const result = await edge(new Request(`http://127.0.0.1${request.url}`, {method:request.method,headers:request.headers,...(body?{body}:{})}), "127.0.0.1");
      response.statusCode = result.status;
      result.headers.forEach((value,key) => response.setHeader(key,value));
      return response.end(await result.text());
    }
    request.body = body ? JSON.parse(body) : {};
    await handler(request, response);
  });
  let html;
  let apiOrigin;
  const web = http.createServer((request, response) => {
    if (["/js/chat-widget.js", "/js/i18n.js"].includes(request.url)) {
      response.setHeader("Content-Type", "application/javascript");
      return response.end(fs.readFileSync(path.join(root, request.url.slice(1))));
    }
    response.setHeader("Content-Type", "text/html; charset=utf-8");
    response.setHeader("Content-Security-Policy", `default-src 'self'; connect-src 'self' ${apiOrigin}`);
    response.end(html);
  });
  try {
    await new Promise((resolve) => api.listen(0, "127.0.0.1", resolve));
    apiOrigin = `http://127.0.0.1:${api.address().port}`;
    const templates = nunjucks.configure(path.join(root, "src/templates"), { autoescape: true });
    html = '<!doctype html><html lang="es"><body>' + templates.render("partials/chat-widget.njk", { chatEndpoint: `${apiOrigin}${runtime === "supabase" ? "/functions/v1/chat" : "/api/chat"}`, url: (value) => value }) + '<script type="module" src="/js/chat-widget.js"></script></body></html>';
    await new Promise((resolve) => web.listen(0, "127.0.0.1", resolve));
    const webOrigin = `http://127.0.0.1:${web.address().port}`;
    process.env.RAG_ALLOWED_ORIGINS = webOrigin;
    edge = createEdgeHandler({...process.env,CHAT_DATABASE_KEY:"test"});
    browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    await page.goto(webOrigin);
    await page.locator("[data-chat-trigger]").click();
    const send = async (message, expected) => {
      await page.locator("[data-chat-input]").fill(message);
      await page.locator("[data-chat-send]").click();
      await page.waitForFunction((text) => document.querySelector("[data-chat-conversation]").textContent.includes(text), expected);
    };
    await send("Hola", "¡Hola! ¿En qué puedo ayudarte?");
    await send("Gracias", "¡Gracias a ti!");
    assert.ok(preflights > 0, "browser must perform a real CORS preflight");
    process.env.RAG_ALLOWED_ORIGINS = "";
    edge = createEdgeHandler({...process.env,CHAT_DATABASE_KEY:"test"});
    await send("Hola", "No he podido conectar.");
  } finally {
    if (browser) await browser.close();
    await Promise.all([api, web].map((server) => new Promise((resolve) => server.close(resolve))));
    global.fetch = savedFetch;
    for (const [name, value] of Object.entries(saved)) {
      if (value === undefined) delete process.env[name]; else process.env[name] = value;
    }
  }
});
