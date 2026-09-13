# Chatbot en Supabase y web estática en IONOS

## Estado de esta adaptación

La función reutiliza la lógica del chatbot existente. La web envía JSON a
`https://PROJECT_REF.supabase.co/functions/v1/chat`; las claves privadas se quedan
en la función. No hacen falta Vercel, Netlify ni un dominio personalizado de Supabase.

Primero se prueba con el proyecto actual. No cambiar el dominio principal ni subir
la web definitiva hasta pasar la conversación desde la función **desplegada**.
Las pruebas Deno locales con servicios reales no equivalen al despliegue remoto.

Comprobaciones realizadas el 9 de septiembre de 2026:

- Proyecto de pruebas: `onjwlzvlfuhleqlkscrx`; 107 fragmentos accesibles.
- 26 pruebas de regresión, 8 del adaptador y 2 de navegador superadas.
- Adaptador probado también en Deno 2.9.6. Conversación real con Supabase/OpenAI:
  saludo, ubicación de Lar de Víes y seguimiento sobre Rural Prado, con fuentes.
- Build estático de preview: 57 rutas y validaciones HTML, CSP y aceptación correctas.
- Copia verificada: `.cache/chat-backups/2026-09-09T14-03-28-106Z`.

Comprobaciones completadas el 13 de septiembre de 2026:

- Función `chat` desplegada y activa en el proyecto actual, versión 4,
  con `verify_jwt = false` y los ocho secretos configurados.
- Conversación remota real superada: saludo, ubicación de Lar de Víes y
  seguimiento sobre Rural Prado; respuestas con fuentes e historial firmado.
- Widget del HTML generado probado en Chromium contra Supabase real con los
  mismos tres mensajes, después de cerrar el aviso de cookies.
- Corregida la ruta interna `/chat` que recibe la función detrás del gateway;
  se mantiene `/functions/v1/chat` como dirección pública. Ocho pruebas pasan.
- Build **de producción** en `public/`: 57 rutas y validaciones de HTML,
  indexación, activos y aceptación superadas. Incluye la URL real de Supabase.
- Retirado el origen temporal localhost. Solo se permiten `https://lardevies.com`
  y `https://www.lardevies.com`. Eliminado el archivo temporal de subida de secretos.
- Pendiente únicamente de publicar y verificar en el hosting real de IONOS.
  La carpeta antigua `IONOS-LISTO/` no se ha actualizado: usar `public/`.

## Variables del proyecto actual

En Supabase > Edge Functions > Secrets:

| Nombre | Valor |
|---|---|
| `OPENAI_API_KEY` | Clave actual de OpenAI |
| `CHAT_DATABASE_KEY` | Valor local de `SUPABASE_SECRET_KEY` |
| `CHAT_HISTORY_SECRET` | Valor actual de `.env.local` (mantenerlo al actualizar) |
| `RAG_ALLOWED_ORIGINS` | `https://lardevies.com,https://www.lardevies.com` y el origen exacto de pruebas |
| `RAG_CHAT_MODEL` | `gpt-5-nano` |
| `RAG_EMBEDDING_MODEL` | `text-embedding-3-small` |
| `CHAT_GLOBAL_BURST_LIMIT` | `100` solicitudes por ventana de 10 minutos |
| `CHAT_GLOBAL_DAILY_LIMIT` | `500` solicitudes por ventana de 24 horas |

`SUPABASE_URL` ya lo proporciona Supabase. El prefijo `SUPABASE_` está reservado;
por eso la clave personalizada se llama `CHAT_DATABASE_KEY`. Si no se configura,
se usa la credencial de servicio incorporada `SUPABASE_SERVICE_ROLE_KEY`.
Nunca copiar `.env.local` al directorio público de IONOS.

La función es pública para visitantes sin cuenta: `verify_jwt = false` solo para
`chat`. La base sigue privada. El SQL `supabase/rag-schema.sql` habilita RLS y
revoca el acceso de `anon` y `authenticated`; no aplicar cambios de permisos a
otras tablas. El proyecto actual ya tiene documentos y RPC: no reingerir por
cambiar de alojamiento.

## Despliegue y pruebas

Con Supabase CLI autenticada y el proyecto actual identificado:

```powershell
npm run rag:test
npm run chat:test:supabase
npm run chat:test:browser
npx supabase functions deploy chat --project-ref PROJECT_REF --use-api
```

La configuración y dependencias están en `supabase/functions/chat/`. La carpeta
`_shared` contiene el núcleo y adaptador. También se puede ejecutar
`npm run chat:prepare:supabase` y cargar el archivo autocontenido generado en
`.cache/supabase-chat/index.ts` desde el editor de Edge Functions del panel.
No contiene secretos. Usar el nombre `chat` y conservar la configuración pública.

Prueba remota (tres mensajes, usa la cuota de OpenAI):

```powershell
$env:CHAT_API_URL = 'https://PROJECT_REF.supabase.co/functions/v1/chat'
$env:CHAT_TEST_ORIGIN = 'https://lardevies.com'
node scripts/test_supabase_chat_live.mjs --remote
```

Después generar la copia estática de prueba con `CHAT_API_URL` definida antes del
build. El build no carga `.env.local` automáticamente. Para el subdominio de
pruebas usar `npm run build:preview`; para el dominio definitivo, `npm run build`.
La dirección de la función y las cabeceras CSP se generan conjuntamente, incluido
`public/.htaccess`. Copiar el contenido de `public`, con los archivos ocultos.

Verificar desde un navegador real: saludo, pregunta factual, seguimiento,
español/inglés/alemán, fuentes, móvil y mensaje de error al fallar el servidor.
Comprobar CORS/CSP desde el origen real de IONOS; un test HTTP no prueba el hosting.

## Controles de la prueba

- 20 solicitudes por identidad de red y ventana de 10 minutos, más los topes
  globales anteriores, persistidos atómicamente en Supabase. Cuentan también los
  saludos. Los topes globales se aplican aunque cambie o se falsifique la IP.
- Los límites globales se comparten por proyecto/secreto entre instancias y son
  ventanas desde la primera petición, no un presupuesto monetario de OpenAI.
- El adaptador ignora cabeceras Vercel. Usa el último salto de `x-forwarded-for`
  o el peer de Deno; verificar en el despliegue cómo lo proporciona la plataforma.
  Si es un proxy compartido, varios visitantes pueden compartir el límite.
- Lista de orígenes obligatoria, JSON de máximo 16 KiB, mensajes de máximo 500
  caracteres, historial firmado y error cerrado si falla el contador.
- CORS no autentica a un visitante ni evita scripts externos. Un atacante aún
  puede agotar las cuotas y causar indisponibilidad; valorar Turnstile al publicar.
- Guardar en el corpus solo información publicable. No registrar conversaciones
  completas ni claves en logs. La firma protege integridad, no cifra el historial.
- La pausa por baja actividad de Free sigue existiendo. Esta adaptación no crea
  tareas de mantenimiento ni contrata Pro.

## Copia y traslado posterior al cliente

Crear una copia antes del traslado:

```powershell
node --env-file=.env.local scripts/backup_chat_knowledge.mjs
```

Genera una carpeta privada ignorada por Git en `.cache/chat-backups` con los 107
fragmentos actuales (o la cantidad actualizada), embeddings, esquema, corpus y
manifiesto SHA-256. No es un backup completo de la cuenta: no incluye secretos,
usuarios, contadores temporales ni otros servicios ajenos al chatbot.

Cuando el cliente tenga su proyecto: ejecutar allí el esquema, importar
`rag_documents.json` conservando los embeddings y verificar conteo y contenido.
Así no se paga de nuevo por generar los mismos embeddings. Configurar claves del
cliente, un nuevo secreto de historial y desplegar la misma función. Repetir las
pruebas antes de recompilar la web con la nueva URL. Mantener el proyecto actual
hasta validar el cambio; no trasladar credenciales personales a la cuenta cliente.

Referencias: [autenticación](https://supabase.com/docs/guides/functions/auth),
[secretos](https://supabase.com/docs/guides/functions/secrets),
[límites](https://supabase.com/docs/guides/functions/limits).
