# Puesta en marcha · Vercel Free + Supabase Free

Esta es la arquitectura de pruebas implementada en el repositorio. Los documentos antiguos
de esta carpeta describen una alternativa basada en Cloudflare; no son los pasos de despliegue
de esta versión.

## Qué está preparado

- Widget incluido en todas las páginas generadas por `scripts/build_static.js`.
- Función privada `POST /api/chat` en Vercel.
- Base de conocimiento en `content/kb/*.md`.
- Búsqueda híbrida en Supabase: full-text de PostgreSQL + `pgvector`.
- Ingesta mediante `npm run rag:ingest`.
- AI SDK con la API directa de OpenAI para embeddings y respuesta.
- Sin almacenamiento de conversaciones ni datos personales.

## 1. Elegir y crear el proyecto de Supabase

No se ha conectado ninguna cuenta desde el repositorio. Cuando se elija la cuenta:

1. Crear un proyecto Free, preferiblemente en una región europea.
2. Abrir el SQL Editor.
3. Ejecutar `supabase/rag-schema.sql` completo.
4. En Project Settings → API, copiar:
   - Project URL → `SUPABASE_URL`.
   - Secret key (`sb_secret_…`) → `SUPABASE_SECRET_KEY`.

La clave secreta solo va en Vercel y en `.env.local`; nunca se utiliza en el navegador.
La tabla tiene RLS activado y no concede acceso a `anon` ni `authenticated`.

## 2. Preparar OpenAI

Crear una API key de OpenAI y guardarla como `OPENAI_API_KEY`. La suscripción de ChatGPT
no incluye el consumo de la API. Los modelos por defecto son:

```text
RAG_CHAT_MODEL=gpt-5-nano
RAG_EMBEDDING_MODEL=text-embedding-3-small
```

Los identificadores son configurables para poder cambiarlos sin editar código.

## 3. Variables locales

Crear `.env.local` en la raíz —está ignorado por Git— con:

```dotenv
OPENAI_API_KEY=...
SUPABASE_URL=https://TU-PROYECTO.supabase.co
SUPABASE_SECRET_KEY=sb_secret_...
RAG_CHAT_MODEL=gpt-5-nano
RAG_EMBEDDING_MODEL=text-embedding-3-small
RAG_MIN_SIMILARITY=0.32
```

## 4. Indexar el corpus

```bash
npm run rag:test
npm run rag:ingest
```

La ingesta valida los 17 Markdown, genera embeddings de 512 dimensiones, hace upsert de
los fragmentos y elimina únicamente los fragmentos de ingestiones anteriores.

## 5. Variables en Vercel

Añadir en Project Settings → Environment Variables:

```text
OPENAI_API_KEY
SUPABASE_URL
SUPABASE_SECRET_KEY
RAG_CHAT_MODEL
RAG_EMBEDDING_MODEL
RAG_MIN_SIMILARITY
```

Aplicarlas inicialmente a Development y Preview. Producción se habilita después de validar
la recuperación y revisar la información legal.

## 6. Probar

Con `vercel dev` o una URL Preview:

```bash
curl -X POST http://localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -d '{"message":"¿Aceptáis perros?","history":[]}'
```

Casos mínimos:

- “¿Aceptáis perros?” debe responder apoyándose en el corpus.
- “¿A qué hora es el check-in?” debe responder con la información de estancia.
- Una pregunta sin respuesta debe devolver `"abstained": true`.
- Las respuestas deben traer fuentes internas cuando el documento tenga URL.

## Límites deliberados de esta fase

- El rate limit es por instancia de Vercel, adecuado para pruebas pero no global.
- No se guardan conversaciones.
- No hay disponibilidad ni precios en tiempo real.
- El umbral `RAG_MIN_SIMILARITY` necesita calibrarse con preguntas reales antes de publicar.
- Antes de producción hay que revisar la política de privacidad porque los mensajes se
  procesan mediante OpenAI, aunque la aplicación solicita que las respuestas no se almacenen.
