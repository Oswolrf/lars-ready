-- Esquema RAG de pruebas para Supabase Free.
-- Ejecutar desde el SQL Editor únicamente después de elegir la cuenta/proyecto.

create extension if not exists vector with schema extensions;

create table if not exists public.rag_documents (
  id text primary key,
  doc_id text not null,
  title text not null,
  source_url text,
  entity text not null,
  type text not null,
  section text not null,
  content text not null,
  content_updated_at date not null,
  position integer not null,
  embedding extensions.vector(512) not null,
  embedding_model text not null,
  ingestion_id uuid not null,
  indexed_at timestamptz not null default now(),
  fts tsvector generated always as (
    to_tsvector(
      'spanish',
      coalesce(title, '') || ' ' || coalesce(section, '') || ' ' || coalesce(content, '')
    )
  ) stored
);

alter table public.rag_documents enable row level security;

create index if not exists rag_documents_fts_idx
  on public.rag_documents using gin (fts);

create index if not exists rag_documents_embedding_hnsw_idx
  on public.rag_documents using hnsw (embedding vector_cosine_ops);

create index if not exists rag_documents_ingestion_idx
  on public.rag_documents (ingestion_id);

create or replace function public.match_rag_documents(
  p_query_text text,
  p_query_embedding extensions.vector(512),
  p_match_count integer default 6
)
returns table (
  id text,
  doc_id text,
  title text,
  source_url text,
  section text,
  content text,
  similarity double precision,
  score double precision
)
language sql
stable
security invoker
set search_path = ''
as $$
  with query_settings as (
    select
      websearch_to_tsquery('spanish', coalesce(p_query_text, '')) as text_query,
      least(greatest(coalesce(p_match_count, 6), 1), 12) as result_limit
  ),
  semantic as (
    select
      document.id,
      row_number() over (
        order by document.embedding OPERATOR(extensions.<=>) p_query_embedding
      ) as semantic_rank,
      1 - (
        document.embedding OPERATOR(extensions.<=>) p_query_embedding
      ) as semantic_similarity
    from public.rag_documents as document
    order by document.embedding OPERATOR(extensions.<=>) p_query_embedding
    limit 30
  ),
  keyword as (
    select
      document.id,
      row_number() over (
        order by ts_rank_cd(document.fts, settings.text_query) desc
      ) as keyword_rank
    from public.rag_documents as document
    cross join query_settings as settings
    where numnode(settings.text_query) > 0
      and document.fts @@ settings.text_query
    order by ts_rank_cd(document.fts, settings.text_query) desc
    limit 30
  ),
  fused as (
    select
      coalesce(semantic.id, keyword.id) as id,
      semantic.semantic_similarity,
      coalesce(1.0 / (60 + semantic.semantic_rank), 0.0)
        + coalesce(1.0 / (60 + keyword.keyword_rank), 0.0) as rrf_score
    from semantic
    full outer join keyword using (id)
  )
  select
    document.id,
    document.doc_id,
    document.title,
    document.source_url,
    document.section,
    document.content,
    coalesce(fused.semantic_similarity, 0)::double precision as similarity,
    fused.rrf_score::double precision as score
  from fused
  join public.rag_documents as document using (id)
  cross join query_settings as settings
  order by fused.rrf_score desc, fused.semantic_similarity desc nulls last
  limit (select result_limit from query_settings);
$$;

revoke all on table public.rag_documents from public, anon, authenticated;
grant select, insert, update, delete on table public.rag_documents
  to service_role;
revoke execute on function public.match_rag_documents(text, extensions.vector, integer)
  from public, anon, authenticated;
grant execute on function public.match_rag_documents(text, extensions.vector, integer)
  to service_role;

comment on table public.rag_documents is
  'Fragmentos privados de la base de conocimiento del chatbot RAG de Lar de Víes.';

comment on function public.match_rag_documents(text, extensions.vector, integer) is
  'Búsqueda híbrida privada: pgvector + full-text español con Reciprocal Rank Fusion.';
