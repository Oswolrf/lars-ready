"use strict";

const crypto = require("node:crypto");
const path = require("node:path");
const siteConfig = require("../site.config.cjs");
const { loadCorpus } = require("./rag/corpus.js");

const root = path.resolve(__dirname, "..");
const EMBEDDING_DIMENSIONS = 512;
const EMBEDDING_BATCH_SIZE = 64;
const DATABASE_BATCH_SIZE = 20;

function requiredEnvironment(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Falta la variable de entorno ${name}`);
  return value.replace(/\/$/, "");
}

async function supabaseRequest(pathname, options = {}) {
  const supabaseUrl = requiredEnvironment("SUPABASE_URL");
  const secretKey = requiredEnvironment("SUPABASE_SECRET_KEY");
  const legacyAuthorization = secretKey.startsWith("eyJ")
    ? { Authorization: `Bearer ${secretKey}` }
    : {};
  const response = await fetch(`${supabaseUrl}${pathname}`, {
    ...options,
    headers: {
      apikey: secretKey,
      "Content-Type": "application/json",
      ...legacyAuthorization,
      ...options.headers,
    },
  });
  if (!response.ok) {
    const details = await response.text();
    throw new Error(`Supabase ${response.status}: ${details.slice(0, 800)}`);
  }
  return response;
}

async function main() {
  if (!process.env.AI_GATEWAY_API_KEY && !process.env.VERCEL_OIDC_TOKEN) {
    throw new Error("Falta AI_GATEWAY_API_KEY (o VERCEL_OIDC_TOKEN) para generar embeddings");
  }

  const validRoutes = new Set(siteConfig.pages.map((page) => page.route));
  const { files, chunks } = loadCorpus({ root, validRoutes });
  const embeddingModel = process.env.RAG_EMBEDDING_MODEL || "openai/text-embedding-3-small";
  const ingestionId = crypto.randomUUID();
  const { embedMany } = await import("ai");

  console.log(`RAG: ${files.length} documentos, ${chunks.length} fragmentos`);
  const embeddings = [];
  for (let offset = 0; offset < chunks.length; offset += EMBEDDING_BATCH_SIZE) {
    const batch = chunks.slice(offset, offset + EMBEDDING_BATCH_SIZE);
    const result = await embedMany({
      model: embeddingModel,
      values: batch.map((chunk) => chunk.content),
      maxParallelCalls: 2,
      providerOptions: { openai: { dimensions: EMBEDDING_DIMENSIONS } },
    });
    embeddings.push(...result.embeddings);
    console.log(`RAG: embeddings ${Math.min(offset + batch.length, chunks.length)}/${chunks.length}`);
  }

  for (const [index, embedding] of embeddings.entries()) {
    if (embedding.length !== EMBEDDING_DIMENSIONS) {
      throw new Error(`Embedding ${index} tiene ${embedding.length} dimensiones; se esperaban ${EMBEDDING_DIMENSIONS}`);
    }
  }

  const rows = chunks.map((chunk, index) => ({
    ...chunk,
    embedding: embeddings[index],
    embedding_model: embeddingModel,
    ingestion_id: ingestionId,
  }));

  for (let offset = 0; offset < rows.length; offset += DATABASE_BATCH_SIZE) {
    const batch = rows.slice(offset, offset + DATABASE_BATCH_SIZE);
    await supabaseRequest("/rest/v1/rag_documents?on_conflict=id", {
      method: "POST",
      headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
      body: JSON.stringify(batch),
    });
    console.log(`RAG: Supabase ${Math.min(offset + batch.length, rows.length)}/${rows.length}`);
  }

  await supabaseRequest(`/rest/v1/rag_documents?ingestion_id=neq.${ingestionId}`, {
    method: "DELETE",
    headers: { Prefer: "return=minimal" },
  });

  console.log(`RAG listo: ${rows.length} fragmentos sincronizados (${ingestionId})`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
