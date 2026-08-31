"use strict";

const fs = require("node:fs");
const path = require("node:path");

const REQUIRED_FIELDS = ["id", "titulo", "entidad", "tipo", "actualizado"];
const MAX_CHUNK_CHARACTERS = 3200;

function parseScalar(value) {
  const trimmed = value.trim();
  if (/^\[.*\]$/.test(trimmed)) {
    const inside = trimmed.slice(1, -1).trim();
    return inside ? inside.split(",").map((item) => item.trim()).filter(Boolean) : [];
  }
  if (/^-?\d+(?:\.\d+)?$/.test(trimmed)) return Number(trimmed);
  if (trimmed === "true") return true;
  if (trimmed === "false") return false;
  return trimmed.replace(/^(["'])(.*)\1$/, "$2");
}

function parseMarkdownDocument(source, filename) {
  const normalized = source.replace(/^\uFEFF/, "").replace(/\r\n/g, "\n");
  const match = normalized.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!match) throw new Error(`${filename}: falta front-matter delimitado por ---`);

  const metadata = {};
  for (const line of match[1].split("\n")) {
    if (!line.trim() || line.trimStart().startsWith("#")) continue;
    const separator = line.indexOf(":");
    if (separator < 1) throw new Error(`${filename}: línea de front-matter inválida: ${line}`);
    metadata[line.slice(0, separator).trim()] = parseScalar(line.slice(separator + 1));
  }

  for (const field of REQUIRED_FIELDS) {
    if (metadata[field] === undefined || metadata[field] === "") {
      throw new Error(`${filename}: falta el campo obligatorio ${field}`);
    }
  }
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(String(metadata.id))) {
    throw new Error(`${filename}: id debe estar en kebab-case`);
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(metadata.actualizado))) {
    throw new Error(`${filename}: actualizado debe usar YYYY-MM-DD`);
  }

  return { metadata, body: match[2].trim() };
}

function slugify(value) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "contenido";
}

function splitOversizedSection(text) {
  if (text.length <= MAX_CHUNK_CHARACTERS) return [text];
  const blocks = text.split(/\n{2,}/).map((block) => block.trim()).filter(Boolean);
  const parts = [];
  let current = "";

  for (const block of blocks) {
    const candidate = current ? `${current}\n\n${block}` : block;
    if (current && candidate.length > MAX_CHUNK_CHARACTERS) {
      parts.push(current);
      current = block;
    } else {
      current = candidate;
    }
  }
  if (current) parts.push(current);
  return parts;
}

function documentHeader(metadata, section) {
  if (metadata.entidad === "rural-prado") {
    return `${metadata.titulo} — Rural Prado (San Tirso de Abres, Asturias) · ${section}`;
  }
  const context = metadata.tipo === "alojamiento"
    ? `${metadata.titulo} — Lar de Víes (A Pontenova, Lugo)`
    : `${metadata.titulo} — Lar de Víes`;
  const capacity = metadata.capacidad ? ` · Capacidad máxima: ${metadata.capacidad}` : "";
  return `${context}${capacity} · ${section}`;
}

function chunkDocument(document, filename) {
  const { metadata, body } = document;
  const headingPattern = /^##\s+(.+)$/gm;
  const headings = [...body.matchAll(headingPattern)];
  if (!headings.length) throw new Error(`${filename}: el documento no contiene secciones ##`);

  const chunks = [];
  const seenIds = new Map();
  for (let index = 0; index < headings.length; index += 1) {
    const heading = headings[index][1].trim();
    const start = headings[index].index + headings[index][0].length;
    const end = headings[index + 1]?.index ?? body.length;
    const sectionBody = body.slice(start, end).trim();
    if (!sectionBody) continue;

    const sectionParts = splitOversizedSection(sectionBody);
    for (let partIndex = 0; partIndex < sectionParts.length; partIndex += 1) {
      const suffix = sectionParts.length > 1 ? ` (${partIndex + 1}/${sectionParts.length})` : "";
      const section = `${heading}${suffix}`;
      const baseId = `${metadata.id}#${slugify(heading)}`;
      const occurrence = (seenIds.get(baseId) || 0) + 1;
      seenIds.set(baseId, occurrence);
      const id = occurrence === 1 ? baseId : `${baseId}-${occurrence}`;
      const content = `${documentHeader(metadata, section)}\n\n${sectionParts[partIndex]}`;

      chunks.push({
        id,
        doc_id: String(metadata.id),
        title: String(metadata.titulo),
        source_url: metadata.url ? String(metadata.url) : null,
        entity: String(metadata.entidad),
        type: String(metadata.tipo),
        section,
        content,
        content_updated_at: String(metadata.actualizado),
        position: chunks.length,
      });
    }
  }
  return chunks;
}

function loadCorpus({ root, validRoutes }) {
  const directory = path.join(root, "content", "kb");
  const files = fs.readdirSync(directory)
    .filter((file) => file.endsWith(".md") && !file.startsWith("_"))
    .sort();
  const ids = new Set();
  const chunks = [];

  for (const file of files) {
    const filename = path.join(directory, file);
    const document = parseMarkdownDocument(fs.readFileSync(filename, "utf8"), filename);
    if (ids.has(document.metadata.id)) throw new Error(`${filename}: id duplicado ${document.metadata.id}`);
    ids.add(document.metadata.id);
    if (document.metadata.url && validRoutes && !validRoutes.has(document.metadata.url)) {
      throw new Error(`${filename}: la ruta ${document.metadata.url} no existe en site.config.cjs`);
    }
    chunks.push(...chunkDocument(document, filename));
  }

  if (!chunks.length) throw new Error("El corpus no produjo ningún fragmento");
  return { files, chunks };
}

module.exports = {
  chunkDocument,
  loadCorpus,
  parseMarkdownDocument,
  slugify,
};
