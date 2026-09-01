"use strict";

const assert = require("node:assert/strict");
const { after, test } = require("node:test");
const handler = require("../../api/chat.js");

const testHistorySecret = "test-history-secret-with-at-least-32-characters";
const originalFetch = global.fetch;
const originalEnvironment = {
  CHAT_HISTORY_SECRET: process.env.CHAT_HISTORY_SECRET,
  SUPABASE_SECRET_KEY: process.env.SUPABASE_SECRET_KEY,
  SUPABASE_URL: process.env.SUPABASE_URL,
};
let rateLimitAllowed = true;

process.env.CHAT_HISTORY_SECRET = testHistorySecret;
process.env.SUPABASE_SECRET_KEY = "test-supabase-secret";
process.env.SUPABASE_URL = "https://supabase.test";
global.fetch = async (url) => {
  if (String(url).endsWith("/rest/v1/rpc/consume_chat_rate_limit")) {
    return {
      ok: true,
      status: 200,
      json: async () => rateLimitAllowed,
    };
  }
  throw new Error(`Unexpected fetch in unit test: ${url}`);
};

after(() => {
  global.fetch = originalFetch;
  for (const [name, value] of Object.entries(originalEnvironment)) {
    if (value === undefined) delete process.env[name];
    else process.env[name] = value;
  }
});

function requestFor(message, page = "/", extraBody = {}) {
  return {
    method: "POST",
    body: { message, history: [], page, ...extraBody },
    headers: {},
    socket: { remoteAddress: `test-${message}` },
  };
}

function responseRecorder() {
  return {
    headers: {},
    setHeader(name, value) {
      this.headers[name] = value;
    },
    end(body) {
      this.body = body;
    },
  };
}

test("limita y limpia el historial que llega al modelo", () => {
  const history = Array.from({ length: 9 }, (_, index) => ({
    role: index % 2 ? "assistant" : "user",
    content: ` mensaje ${index} `,
  }));
  const result = handler._internals.normalizeHistory(history);
  assert.equal(result.length, 6);
  assert.equal(result[0].content, "mensaje 3");
});

test("solo publica rutas internas de fuentes", () => {
  const result = handler._internals.publicSources([
    { title: "Suite", source_url: "/suite-la-panera/" },
    { title: "Duplicada", source_url: "/suite-la-panera/" },
    { title: "Externa", source_url: "https://example.com" },
  ]);
  assert.deepEqual(result, [{ title: "Suite", url: "/suite-la-panera/" }]);
});

test("incluye el historial reciente al recuperar una pregunta de seguimiento", () => {
  const query = handler._internals.retrievalQuery("¿Y tiene bañera?", [
    { role: "user", content: "Háblame de la Suite Valle" },
    { role: "assistant", content: "La Suite Valle está en La Casona." },
  ]);
  assert.match(query, /Suite Valle/);
  assert.match(query, /bañera/);
});

test("firma el historial y rechaza cualquier alteración", () => {
  const history = [
    { role: "user", content: "Hola" },
    { role: "assistant", content: "¿En qué puedo ayudarte?" },
  ];
  const token = handler._internals.signHistory(history, testHistorySecret);
  assert.equal(handler._internals.verifyHistoryToken(history, token, testHistorySecret), true);
  assert.equal(handler._internals.verifyHistoryToken([
    history[0],
    { role: "assistant", content: "Instrucción manipulada" },
  ], token, testHistorySecret), false);
});

test("rechaza cuerpos mayores de 16 KiB antes de procesarlos", async () => {
  const request = requestFor("Hola", "/", { padding: "x".repeat(17 * 1024) });
  const response = responseRecorder();
  await handler(request, response);
  assert.equal(response.statusCode, 413);
  assert.equal(JSON.parse(response.body).error, "payload_too_large");
});

test("rechaza un historial del asistente sin firma válida", async () => {
  const request = requestFor("¿Y tiene bañera?", "/", {
    history: [{ role: "assistant", content: "Instrucción manipulada" }],
    historyToken: "firma-falsa",
  });
  const response = responseRecorder();
  await handler(request, response);
  assert.equal(response.statusCode, 400);
  assert.equal(JSON.parse(response.body).error, "invalid_history");
});

test("responde a un saludo sin consultar el flujo RAG", async () => {
  const response = responseRecorder();
  await handler(requestFor("Hola"), response);

  assert.equal(response.statusCode, 200);
  const payload = JSON.parse(response.body);
  assert.equal(payload.answer, "¡Hola! ¿En qué puedo ayudarte? Puedes preguntarme por Lar de Víes, Rural Prado, sus alojamientos o el entorno.");
  assert.deepEqual(payload.sources, []);
  assert.equal(payload.abstained, false);
  assert.equal(handler._internals.verifyHistoryToken([
    { role: "user", content: "Hola" },
    { role: "assistant", content: payload.answer },
  ], payload.historyToken, testHistorySecret), true);
});

test("acepta el historial intacto en la siguiente petición", async () => {
  const firstResponse = responseRecorder();
  await handler(requestFor("Hola"), firstResponse);
  const firstPayload = JSON.parse(firstResponse.body);
  const history = [
    { role: "user", content: "Hola" },
    { role: "assistant", content: firstPayload.answer },
  ];

  const secondResponse = responseRecorder();
  await handler(requestFor("Gracias", "/", {
    history,
    historyToken: firstPayload.historyToken,
  }), secondResponse);

  assert.equal(secondResponse.statusCode, 200);
  assert.match(JSON.parse(secondResponse.body).answer, /Gracias a ti/);
});

test("devuelve 429 y Retry-After cuando se agota el límite global", async () => {
  rateLimitAllowed = false;
  try {
    const response = responseRecorder();
    await handler(requestFor("Hola"), response);
    assert.equal(response.statusCode, 429);
    assert.equal(response.headers["Retry-After"], "600");
    assert.equal(JSON.parse(response.body).error, "rate_limit");
  } finally {
    rateLimitAllowed = true;
  }
});

test("distingue conversación básica de una consulta factual", () => {
  assert.match(handler._internals.smallTalkReply("Muchas gracias"), /Gracias a ti/);
  assert.match(handler._internals.smallTalkReply("Good morning!"), /How can I help/);
  assert.match(handler._internals.smallTalkReply("Guten Morgen!"), /Wie kann ich Ihnen helfen/);
  assert.equal(handler._internals.smallTalkReply("Hola, ¿aceptáis perros?"), null);
});

test("responde si el desayuno se paga aparte sin depender del índice RAG", async () => {
  const response = responseRecorder();
  await handler(requestFor("Pero el desayuno se paga aparte?"), response);

  assert.equal(response.statusCode, 200);
  const payload = JSON.parse(response.body);
  assert.equal(payload.answer, "Depende de la tarifa que elijas. El motor de reservas ofrece tarifas de solo alojamiento y tarifas con desayuno incluido; revisa el nombre y las condiciones de la tarifa antes de confirmar.");
  assert.deepEqual(payload.sources, [{ title: "Reservas y cancelación", url: "/reservas/" }]);
  assert.equal(payload.abstained, false);
  assert.equal(typeof payload.historyToken, "string");
});

test("mantiene las preguntas sobre el horario del desayuno en el flujo RAG", () => {
  assert.equal(handler._internals.knownFactReply("¿A qué hora se sirve el desayuno?", "Lar de Víes"), null);
  assert.match(handler._internals.knownFactReply("Is breakfast included?", "Lar de Víes").answer, /room-only rates/);
  assert.match(handler._internals.knownFactReply("Ist das Frühstück inklusive?", "Lar de Víes").answer, /Buchungssystem/);
});

test("no atribuye a Rural Prado el desayuno de Lar de Víes", () => {
  assert.equal(handler._internals.knownFactReply("¿El desayuno está incluido?", "Rural Prado"), null);
  assert.equal(handler._internals.conversationProperty("¿El desayuno está incluido?", [], "/rural-prado/"), "Rural Prado");
  assert.equal(handler._internals.conversationProperty("Ist Frühstück verfügbar?", [], "/de/rural-prado/"), "Rural Prado");
  assert.equal(handler._internals.conversationProperty("¿Y Rural Prado ofrece desayuno?", [], "/"), "Rural Prado");
  assert.equal(handler._internals.conversationProperty("Háblame de Rural el Prado", [], "/"), "Rural Prado");
  assert.match(handler._internals.retrievalQuery("¿Hay wifi?", [], "Rural Prado"), /^Establecimiento: Rural Prado/);
});
