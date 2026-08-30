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
  assert.equal(corpus.files.length, 17);
  assert.ok(corpus.chunks.length >= 70);
  assert.equal(new Set(corpus.chunks.map((chunk) => chunk.id)).size, corpus.chunks.length);
  for (const chunk of corpus.chunks) {
    assert.ok(chunk.content.includes("Lar de Víes"));
    assert.ok(chunk.section.length > 0);
  }
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
