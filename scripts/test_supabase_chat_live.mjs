// Deno local test against the configured database and OpenAI, or Node remote test.
// Never prints credentials. Remote tests require CHAT_API_URL to be explicit.
import assert from "node:assert/strict";
import { createEdgeHandler } from "../supabase/functions/_shared/edge-handler.mjs";

const env = typeof Deno !== "undefined" ? Deno.env.toObject() : process.env;
const origin = env.CHAT_TEST_ORIGIN || "https://lardevies.com";
const remote = process.argv.includes("--remote");
const endpoint = remote ? env.CHAT_API_URL : `${env.SUPABASE_URL}/functions/v1/chat`;
if (!endpoint || !/^https:\/\//.test(endpoint)) throw new Error("Falta CHAT_API_URL HTTPS para la prueba remota");
const handler = remote ? null : createEdgeHandler({...env,CHAT_DATABASE_KEY:env.SUPABASE_SECRET_KEY,RAG_ALLOWED_ORIGINS:origin});
const send = (request) => remote ? fetch(request) : handler(request, "live-smoke-test");
let history = [];
let historyToken;
for (const message of ["Hola", "¿Dónde está Lar de Víes?", "¿Y Rural Prado?"]) {
  const start = Date.now();
  const response = await send(new Request(endpoint,{method:"POST",headers:{Origin:origin,"Content-Type":"application/json"},body:JSON.stringify({message,history,historyToken,page:"/"})}));
  const result = await response.json();
  assert.equal(response.status,200,`Falló la consulta: ${result.error || response.status}`);
  assert.equal(response.headers.get("Access-Control-Allow-Origin"),origin);
  assert.ok(result.answer?.trim());
  assert.ok(result.historyToken);
  if (message !== "Hola") {
    assert.equal(result.abstained,false,"No se recuperó información para la pregunta de prueba");
    assert.ok(result.sources.length>0,"Faltan fuentes de la base de conocimiento");
  }
  console.log(JSON.stringify({mode:remote?"deployed":"local-deno",message,answer:result.answer,sources:result.sources,ms:Date.now()-start}));
  history = [...history,{role:"user",content:message},{role:"assistant",content:result.answer}].slice(-6);
  historyToken = result.historyToken;
}
const denied = await send(new Request(endpoint,{method:"OPTIONS",headers:{Origin:"https://unauthorized.example","Access-Control-Request-Method":"POST"}}));
assert.equal(denied.status,403);
console.log("Conversación con fuentes, seguimiento firmado y bloqueo de origen: OK");
