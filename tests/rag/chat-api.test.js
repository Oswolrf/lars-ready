"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const handler = require("../../api/chat.js");

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
