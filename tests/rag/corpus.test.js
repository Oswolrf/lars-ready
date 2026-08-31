"use strict";

const assert = require("node:assert/strict");
const path = require("node:path");
const test = require("node:test");
const siteConfig = require("../../site.config.cjs");
const { loadCorpus, parseMarkdownDocument, slugify } = require("../../scripts/rag/corpus.js");

test("normaliza encabezados en identificadores estables", () => {
  assert.equal(slugify("Capacidad y camas"), "capacidad-y-camas");
  assert.equal(slugify("Ubicación y entorno"), "ubicacion-y-entorno");
});

test("rechaza documentos sin front-matter", () => {
  assert.throws(() => parseMarkdownDocument("## Contenido\nTexto", "prueba.md"), /front-matter/);
});

test("carga todo el corpus con rutas válidas y chunks autocontenidos", () => {
  const root = path.resolve(__dirname, "../..");
  const validRoutes = new Set(siteConfig.pages.map((page) => page.route));
  const corpus = loadCorpus({ root, validRoutes });
  assert.equal(corpus.files.length, 18);
  assert.ok(corpus.chunks.length >= 80);
  assert.equal(new Set(corpus.chunks.map((chunk) => chunk.id)).size, corpus.chunks.length);
  for (const chunk of corpus.chunks) {
    const propertyName = chunk.entity === "rural-prado" ? "Rural Prado" : "Lar de Víes";
    assert.ok(chunk.content.includes(propertyName));
    assert.ok(chunk.section.length > 0);
  }
});

test("mantiene Rural Prado separado de Lar de Víes", () => {
  const root = path.resolve(__dirname, "../..");
  const validRoutes = new Set(siteConfig.pages.map((page) => page.route));
  const corpus = loadCorpus({ root, validRoutes });
  const ruralChunks = corpus.chunks.filter((chunk) => chunk.doc_id === "rural-prado");

  assert.ok(ruralChunks.length >= 10);
  assert.ok(ruralChunks.every((chunk) => chunk.entity === "rural-prado"));
  assert.ok(ruralChunks.every((chunk) => chunk.source_url === "/rural-prado/"));
  assert.ok(ruralChunks.every((chunk) => chunk.content.includes("Rural Prado (San Tirso de Abres, Asturias)")));
  assert.ok(ruralChunks.every((chunk) => !chunk.content.includes("A Pontenova, Lugo")));
  assert.ok(ruralChunks.some((chunk) => chunk.id === "rural-prado#apartamento-salgueiro"));
  assert.ok(ruralChunks.every((chunk) => !chunk.content.includes("Ático de Prado")));
  assert.match(ruralChunks.find((chunk) => chunk.id === "rural-prado#informacion-no-confirmada").content, /Servicio de desayunos o cenas/);
});

test("documenta las tarifas con y sin desayuno de forma recuperable", () => {
  const root = path.resolve(__dirname, "../..");
  const validRoutes = new Set(siteConfig.pages.map((page) => page.route));
  const corpus = loadCorpus({ root, validRoutes });
  const breakfastChunk = corpus.chunks.find((chunk) => chunk.id === "reservas-y-cancelacion#desayuno-y-tarifa");

  assert.ok(breakfastChunk);
  assert.equal(breakfastChunk.source_url, "/reservas/");
  assert.match(breakfastChunk.content, /solo alojamiento \(SA\)/);
  assert.match(breakfastChunk.content, /desayuno incluido/);
  assert.match(breakfastChunk.content, /depende de la tarifa seleccionada/);
});
