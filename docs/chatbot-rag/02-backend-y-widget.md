# 02 · Worker, widget, base de datos y RGPD

> Documento 3 de 4. Todo lo que se ejecuta en producción: el endpoint, el almacenamiento,
> el widget y las obligaciones legales.

## 1. Estructura de ficheros

```
repositorio/
├── content/kb/*.md              ← corpus (ya escrito)
├── scripts/
│   └── build_kb_index.js        ← ingesta: genera el índice
├── chat/                        ← el backend, se despliega a Cloudflare
│   ├── wrangler.toml
│   ├── schema.sql               ← esquema de D1
│   └── src/
│       ├── index.js             ← capa de plataforma (fetch handler)
│       ├── kb-meta.json         ← generado por la ingesta, versionado
│       ├── kb-vectors.bin       ← generado por la ingesta, versionado
│       └── core/
│           ├── normalizar.js    ← tokenizador COMPARTIDO con la ingesta
│           ├── indice.js
│           ├── recuperar.js
│           ├── prompt.js
│           └── openai.js
├── js/chat-widget.js            ← widget (entra en el bundle del sitio)
├── css/chat-widget.css
└── src/templates/partials/chat-widget.njk
```

**El normalizador es un único fichero ESM** (`chat/src/core/normalizar.js`) que importan
tanto el Worker como `scripts/build_kb_index.js` (con `await import()` si el script sigue
siendo CommonJS). Esto no es un detalle de estilo: es lo que garantiza que el tokenizador
que construyó el índice y el que procesa la pregunta sean literalmente el mismo código.

Secretos: **nunca en el repositorio**. Se cargan con `wrangler secret put`.
Añadir a `.gitignore`: `.dev.vars` (el fichero de secretos para desarrollo local).

## 2. Contrato del endpoint

```
POST https://chat.lardevies.com/chat
Content-Type: application/json

{
  "sessionId": "3f2a…",                     // uuid v4 generado por el widget
  "message": "¿La Panera admite mascotas?", // ≤ 500 caracteres
  "history": [                              // ≤ 6 turnos, opcional
    { "rol": "user", "contenido": "…" },
    { "rol": "assistant", "contenido": "…" }
  ]
}
```

Respuesta correcta:

```json
{
  "answer": "Las mascotas son bienvenidas bajo petición 🐾…",
  "sources": [{ "titulo": "Suite Panera", "url": "/suite-la-panera/" }],
  "abstained": false,
  "sessionId": "3f2a…"
}
```

Error (el widget nunca muestra detalles técnicos):

```json
{ "error": "rate_limit", "message": "Has enviado muchos mensajes seguidos. Espera un momento." }
```

Códigos: `400` entrada inválida · `403` origen no permitido · `429` rate limit ·
`503` OpenAI no disponible · `500` error interno.

## 3. CORS (crítico)

El widget está en `https://lardevies.com` y el Worker en `https://chat.lardevies.com`: son
orígenes distintos, así que hay CORS de por medio.

- Responder al **preflight `OPTIONS`** (una petición `POST` con `Content-Type:
  application/json` siempre lo dispara) con:
  - `Access-Control-Allow-Origin: https://lardevies.com` — **exacto, nunca `*`**
  - `Access-Control-Allow-Methods: POST, OPTIONS`
  - `Access-Control-Allow-Headers: Content-Type`
  - `Access-Control-Max-Age: 86400`
- En la respuesta real, repetir `Access-Control-Allow-Origin` con el mismo valor exacto.
- Además, **validar en el código** el header `Origin`: si no es `https://lardevies.com`,
  devolver `403` sin procesar nada. CORS protege al navegador; esta comprobación te protege
  a ti de peticiones desde scripts.
- No usar credenciales ni cookies: `Access-Control-Allow-Credentials` no se envía.

## 4. La línea de CSP que hay que cambiar

En `scripts/build_static.js`, en la constante `contentSecurityPolicy` (~línea 26):

```js
// antes
"connect-src 'self' https://sibforms.com https://*.sibforms.com",
// después
"connect-src 'self' https://sibforms.com https://*.sibforms.com https://chat.lardevies.com",
```

Es **el único cambio en el sitio**. Desde ahí se propaga solo al `.htaccess` generado, a
`_headers`, a `deploy/nginx.conf.example` y a `deploy/vercel.json`, porque todos se generan
a partir de esa misma constante. Después, `npm run adapters:check` debe seguir pasando.

## 5. `chat/src/index.js` — capa de plataforma

Responsabilidades, en orden:

1. Responder al preflight `OPTIONS` (§3).
2. Aceptar solo `POST` a la ruta `/chat` con `Content-Type: application/json`.
3. Validar `Origin` contra `https://lardevies.com`. Si no coincide → `403`.
4. Validar la entrada: `message` no vacío y ≤ 500 caracteres; `history` ≤ 6 turnos con cada
   contenido ≤ 1.000 caracteres; `sessionId` con formato uuid. Truncado duro.
5. Rate limit: **20 mensajes / 10 minutos por IP** (hash de `CF-Connecting-IP` con sal) y
   **tope diario global configurable** (por defecto 500). Al superar el tope global se
   responde `429`: es la salvaguarda que impide que un abuso se convierta en una factura.
6. Delegar en el núcleo (`core/`).
7. Escribir la conversación en D1 con `ctx.waitUntil()`, para no retrasar la respuesta.
8. Devolver JSON con `Cache-Control: no-store` y las cabeceras CORS.

**Regla de aislamiento**: los ficheros de `core/` no reciben nunca `env`, `Request`,
`Response` ni el binding de D1. Reciben datos y devuelven datos.

### Carga del índice (importante para el límite de CPU)

En el **ámbito del módulo**, fuera del `fetch`, para que se ejecute una vez por isolate y
se reutilice en todas las peticiones siguientes:

```js
import meta from './kb-meta.json';
import vectoresBin from './kb-vectors.bin';   // binario, no base64

const VECTORES = new Float32Array(vectoresBin);   // 91 × 512 contiguos
// el vector del chunk i ocupa VECTORES.subarray(i * DIMS, (i + 1) * DIMS)
```

No decodificar base64 en cada petición ni guardar los vectores como arrays de JavaScript:
eso es lo único que puede acercarse a los 10 ms de CPU del plan gratuito.

### Llamadas a OpenAI

- Timeout de 20 s con `AbortController`. **Un** reintento ante error de red o `5xx`. Nunca
  bucles.
- Los errores se registran sin volcar la clave ni el prompt.

## 6. Configuración (`chat/wrangler.toml`)

```toml
name = "lar-de-vies-chat"
main = "src/index.js"
compatibility_date = "2026-08-28"

routes = [{ pattern = "chat.lardevies.com", custom_domain = true }]

[[d1_databases]]
binding = "DB"
database_name = "lar-de-vies-chat"
database_id = "…"

[vars]
MODELO_CHAT      = "gpt-4o-mini"             # VERIFICAR contra la doc de OpenAI
MODELO_EMBEDDING = "text-embedding-3-small"  # VERIFICAR
DIMENSIONES      = "512"
UMBRAL_COSENO    = "0.35"                    # calibrado con el set de evaluación
MAX_FRAGMENTOS   = "8"
MAX_TOKENS_CTX   = "2500"
LIMITE_IP        = "20"
LIMITE_VENTANA_MIN = "10"
LIMITE_DIARIO    = "500"
ORIGEN_PERMITIDO = "https://lardevies.com"
```

Secretos (nunca en el toml): `wrangler secret put OPENAI_API_KEY` y
`wrangler secret put SAL_HASH_IP`.

## 7. Base de datos (Cloudflare D1)

Crear la base con **región europea** por RGPD:
`wrangler d1 create lar-de-vies-chat --location weur`

`chat/schema.sql`:

```sql
CREATE TABLE IF NOT EXISTS chat_sessions (
  id          TEXT PRIMARY KEY,
  creada_en   TEXT NOT NULL,
  idioma      TEXT,
  ip_hash     TEXT NOT NULL,       -- SHA-256 de (IP + sal). Nunca la IP en claro
  user_agent  TEXT
);

CREATE TABLE IF NOT EXISTS chat_messages (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id  TEXT NOT NULL REFERENCES chat_sessions(id) ON DELETE CASCADE,
  rol         TEXT NOT NULL CHECK (rol IN ('user','assistant')),
  contenido   TEXT NOT NULL,
  fragmentos  TEXT,                -- JSON con los ids de los chunks usados, para auditar
  abstuvo     INTEGER NOT NULL DEFAULT 0,
  tokens_in   INTEGER,
  tokens_out  INTEGER,
  latencia_ms INTEGER,
  creado_en   TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_messages_session ON chat_messages(session_id);
CREATE INDEX IF NOT EXISTS idx_messages_fecha   ON chat_messages(creado_en);

CREATE TABLE IF NOT EXISTS chat_rate_limit (
  ip_hash  TEXT NOT NULL,
  ventana  TEXT NOT NULL,
  contador INTEGER NOT NULL DEFAULT 1,
  PRIMARY KEY (ip_hash, ventana)
);
```

**Siempre sentencias preparadas con `.bind()`.** Ninguna variable se concatena en SQL.

**Purga**: un Cron Trigger mensual del propio Worker borra las sesiones con
`creada_en < date('now','-12 months')` y limpia `chat_rate_limit`. Se declara en
`wrangler.toml` con `[triggers] crons = ["0 4 1 * *"]`.

El campo `fragmentos` es lo que permite responder meses después a "¿de dónde sacó el bot
esto?". No lo quites para ahorrar espacio.

## 8. RGPD

Guardar conversaciones completas **es tratamiento de datos personales** (el usuario puede
escribir su nombre, sus fechas o su email en el chat). Tareas obligatorias:

1. **Ampliar `politica-de-privacidad.html`** con un apartado "Asistente virtual":
   - **Finalidad**: atender consultas y mejorar el servicio.
   - **Base legal**: interés legítimo (art. 6.1.f RGPD).
   - **Datos tratados**: contenido de la conversación, fecha, idioma, identificador de
     sesión y dirección IP **seudonimizada mediante hash**.
   - **Destinatarios**: **OpenAI** (procesamiento de la consulta) y **Cloudflare**
     (alojamiento del servicio y de la base de datos), ambos como encargados del
     tratamiento, con transferencias internacionales amparadas por cláusulas contractuales
     tipo. La base de datos se crea en región europea.
   - **Conservación**: 12 meses.
   - **Derechos**: acceso, rectificación, supresión y oposición en `reservas@lardevies.com`.
2. **Aviso en el widget antes del primer mensaje**, en una línea: *"Esta conversación se
   guarda para mejorar el servicio. No escribas datos personales. Más información en la
   política de privacidad."*
3. **El bot no pide datos personales** — ya está en el prompt del sistema.
4. Añadir el asistente al **registro de actividades de tratamiento** si procede.

> Respecto a la versión con backend en IONOS, aquí hay **un encargado del tratamiento más**
> (Cloudflare). Es el precio de tener el chat aislado de la web, y se resuelve con un
> párrafo en la política de privacidad.

Este chatbot **no usa cookies**: el identificador de sesión vive en `sessionStorage` y
desaparece al cerrar la pestaña, así que no hay que tocar el banner de consentimiento
existente (`js/cookie-consent.js`). Es una decisión deliberada.

## 9. El widget

### Ficheros

| Fichero | Qué es |
|---|---|
| `js/chat-widget.js` | Lógica del widget |
| `css/chat-widget.css` | Estilos, siguiendo el patrón de los CSS existentes en `css/` |
| `src/templates/partials/chat-widget.njk` | Marcado, inyectado en todas las páginas |

### Integración con el build

1. Añadir `import "../js/chat-widget.js";` en `src/site-entry.js` (así entra en el bundle
   con huella de contenido; **no** añadir un `<script>` suelto: la CSP lo bloquea).
2. En `scripts/build_static.js`, dentro de `replaceSharedComponents()` (~línea 370), añadir
   el partial al final del `body`, igual que `booking-dialog.njk`:
   `$("body").append(render("partials/chat-widget.njk", page));`
3. Añadir el origen del chat a `connect-src` (§4).
4. La URL del endpoint va en el partial como `data-chat-endpoint="https://chat.lardevies.com/chat"`,
   y el JS la lee. **No se escribe en el JavaScript.**

### Comportamiento

- Botón flotante que abre un panel de conversación.
- Mensaje de bienvenida con **3 preguntas sugeridas** en botones (textos en `03`, A.3).
- Indicador de "escribiendo…" mientras se espera.
- Historial en `sessionStorage`, se descarta al cerrar la pestaña.
- Errores: mensaje amable y botón de reintentar. Nunca un error técnico en pantalla.

### Streaming (opcional, recomendado en una segunda pasada)

A diferencia del hosting compartido, un Worker **sí puede** devolver la respuesta en
streaming (SSE o `ReadableStream`), de modo que el texto aparezca palabra a palabra en vez
de todo de golpe tras 1–3 s. Recomendación: **implementar primero la versión sin
streaming** (más simple de depurar) y añadirlo después, enviando el array `sources` como
evento final. Las abstenciones nunca se transmiten en streaming: son instantáneas.

### Accesibilidad y reutilización

Reutiliza los patrones que ya existen — **no escribas un modal desde cero**:

- `js/dialog.js` y `js/booking-modal.js` ya resuelven foco atrapado, cierre con `Esc` y
  restauración del foco.
- El área de mensajes necesita `aria-live="polite"`.
- El proyecto ya audita accesibilidad con `@axe-core/playwright` en `tests/e2e/`.

### Colisión en la esquina inferior

Ahí ya viven **`js/sticky-cta.js`**, **`js/back-to-top.js`** y **`js/footer-collision.js`**.
Antes de dar el widget por bueno hay que revisar `z-index` y desplazamiento vertical, y
probarlo a 375 px con el CTA pegajoso visible y con el pie de página a la vista. Es el punto
donde más fácil es romper algo existente.

### Seguridad en el cliente (crítico)

- La respuesta del modelo se inserta con **`textContent`**, jamás con `innerHTML`.
- Los enlaces los construye el widget a partir del array `sources`, **no** parseando URLs
  del texto de la respuesta.

## 10. Despliegue

Son dos despliegues independientes, y esa es justamente la ventaja:

**La web** (como hasta ahora):

```bash
npm run build
```

y subir el contenido de `public/` a IONOS. El widget viaja dentro del bundle JS.

**El chat**:

```bash
cd chat && npx wrangler deploy
```

Actualizar el corpus no toca la web para nada: `npm run kb:index` regenera el índice y un
`wrangler deploy` lo publica.

## 11. Comprobaciones antes de dar por terminado

```bash
npm run validate
```

```bash
npm run test:e2e
```

Y a mano, contra producción:

- `curl -X POST https://chat.lardevies.com/chat` **sin** header `Origin` → **403**.
- Con `Origin: https://ejemplo-malicioso.com` → **403**.
- Con `Origin: https://lardevies.com` y una pregunta del corpus → respuesta con `sources`.
- Una pregunta fuera del corpus → `abstained: true`.
- 25 peticiones seguidas → las últimas devuelven **429**.
- Consola del navegador sin ningún error de CSP en ninguna página.
- En el panel de Cloudflare, comprobar que el consumo de CPU por invocación queda holgado
  bajo los 10 ms.
