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

create table if not exists public.rag_chat_rate_limits (
  identity_hash text primary key,
  window_started_at timestamptz not null default now(),
  request_count integer not null default 0 check (request_count >= 0),
  updated_at timestamptz not null default now(),
  constraint rag_chat_rate_limits_identity_hash_check
    check (identity_hash ~ '^[a-f0-9]{32}$')
);

alter table public.rag_documents enable row level security;
alter table public.rag_chat_rate_limits enable row level security;

create index if not exists rag_chat_rate_limits_updated_at_idx
  on public.rag_chat_rate_limits (updated_at);

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

create or replace function public.consume_chat_rate_limit(
  p_identity_hash text,
  p_window_seconds integer default 600,
  p_max_requests integer default 20
)
returns boolean
language plpgsql
volatile
security invoker
set search_path = ''
as $$
declare
  effective_window integer := least(greatest(coalesce(p_window_seconds, 600), 60), 86400);
  effective_limit integer := least(greatest(coalesce(p_max_requests, 20), 1), 1000);
  current_count integer;
begin
  if p_identity_hash is null or p_identity_hash !~ '^[a-f0-9]{32}$' then
    return false;
  end if;

  insert into public.rag_chat_rate_limits as rate_limit (
    identity_hash,
    window_started_at,
    request_count,
    updated_at
  ) values (
    p_identity_hash,
    now(),
    1,
    now()
  )
  on conflict (identity_hash) do update
  set
    window_started_at = case
      when rate_limit.window_started_at <= now() - make_interval(secs => effective_window) then now()
      else rate_limit.window_started_at
    end,
    request_count = case
      when rate_limit.window_started_at <= now() - make_interval(secs => effective_window) then 1
      else rate_limit.request_count + 1
    end,
    updated_at = now()
  returning request_count into current_count;

  if random() < 0.01 then
    delete from public.rag_chat_rate_limits
    where updated_at < now() - interval '2 days';
  end if;

  return current_count <= effective_limit;
end;
$$;

revoke all on table public.rag_documents from public, anon, authenticated;
grant select, insert, update, delete on table public.rag_documents
  to service_role;
revoke all on table public.rag_chat_rate_limits from public, anon, authenticated;
grant select, insert, update, delete on table public.rag_chat_rate_limits
  to service_role;
revoke execute on function public.match_rag_documents(text, extensions.vector, integer)
  from public, anon, authenticated;
grant execute on function public.match_rag_documents(text, extensions.vector, integer)
  to service_role;
revoke execute on function public.consume_chat_rate_limit(text, integer, integer)
  from public, anon, authenticated;
grant execute on function public.consume_chat_rate_limit(text, integer, integer)
  to service_role;

comment on table public.rag_documents is
  'Fragmentos privados de la base de conocimiento del chatbot RAG de Lar de Víes.';

comment on function public.match_rag_documents(text, extensions.vector, integer) is
  'Búsqueda híbrida privada: pgvector + full-text español con Reciprocal Rank Fusion.';

comment on table public.rag_chat_rate_limits is
  'Contadores efímeros y seudonimizados para limitar el abuso del chatbot.';

comment on function public.consume_chat_rate_limit(text, integer, integer) is
  'Consume de forma atómica una solicitud del límite global del chatbot.';
