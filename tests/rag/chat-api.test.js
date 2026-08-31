"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const handler = require("../../api/chat.js");

function requestFor(message, page = "/") {
  return {
    method: "POST",
    body: { message, history: [], page },
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

test("responde a un saludo sin consultar el flujo RAG", async () => {
  const response = responseRecorder();
  await handler(requestFor("Hola"), response);

  assert.equal(response.statusCode, 200);
  assert.deepEqual(JSON.parse(response.body), {
    answer: "¡Hola! ¿En qué puedo ayudarte? Puedes preguntarme por Lar de Víes, Rural Prado, sus alojamientos o el entorno.",
    sources: [],
    abstained: false,
  });
});

test("distingue conversación básica de una consulta factual", () => {
  assert.match(handler._internals.smallTalkReply("Muchas gracias"), /Gracias a ti/);
  assert.match(handler._internals.smallTalkReply("Good morning!"), /How can I help/);
  assert.equal(handler._internals.smallTalkReply("Hola, ¿aceptáis perros?"), null);
});

test("responde si el desayuno se paga aparte sin depender del índice RAG", async () => {
  const response = responseRecorder();
  await handler(requestFor("Pero el desayuno se paga aparte?"), response);

  assert.equal(response.statusCode, 200);
  assert.deepEqual(JSON.parse(response.body), {
    answer: "Depende de la tarifa que elijas. El motor de reservas ofrece tarifas de solo alojamiento y tarifas con desayuno incluido; revisa el nombre y las condiciones de la tarifa antes de confirmar.",
    sources: [{ title: "Reservas y cancelación", url: "/reservas/" }],
    abstained: false,
  });
});

test("mantiene las preguntas sobre el horario del desayuno en el flujo RAG", () => {
  assert.equal(handler._internals.knownFactReply("¿A qué hora se sirve el desayuno?", "Lar de Víes"), null);
  assert.match(handler._internals.knownFactReply("Is breakfast included?", "Lar de Víes").answer, /room-only rates/);
});

test("no atribuye a Rural Prado el desayuno de Lar de Víes", () => {
  assert.equal(handler._internals.knownFactReply("¿El desayuno está incluido?", "Rural Prado"), null);
  assert.equal(handler._internals.conversationProperty("¿El desayuno está incluido?", [], "/rural-prado/"), "Rural Prado");
  assert.equal(handler._internals.conversationProperty("¿Y Rural Prado ofrece desayuno?", [], "/"), "Rural Prado");
  assert.match(handler._internals.retrievalQuery("¿Hay wifi?", [], "Rural Prado"), /^Establecimiento: Rural Prado/);
});
