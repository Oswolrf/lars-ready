# 00 · Arquitectura del chatbot RAG de Lar de Víes

> Documento 1 de 4. Es la visión general: qué se construye, dónde vive cada pieza y
> cuánto cuesta. Los detalles de implementación están en `01`, `02` y `03`.

## 1. Qué queremos

Un asistente en lardevies.com que responda preguntas de los visitantes usando
**exclusivamente** la información que nosotros le damos, en el idioma en el que
pregunten, y que **derive a una persona** (email y teléfono) siempre que no tenga la
respuesta. No reserva, no consulta disponibilidad, no da precios que no estén en el
corpus, no opina.

El requisito principal no es "que responda bien": es **que no invente nunca**. Todas las
decisiones técnicas de este documento están subordinadas a eso.

## 2. Restricciones del proyecto

| Restricción | Consecuencia |
|---|---|
| La web es estática y se construye con `scripts/build_static.js` → `public/` | El widget viaja dentro del bundle JS del sitio; el backend se despliega aparte |
| `main()` hace `fs.rmSync(public)` en cada build | Nada sobrevive dentro de `public/` entre builds |
| La web se aloja en **IONOS / Apache** | Sigue igual: IONOS solo sirve ficheros estáticos. El chat no vive ahí |
| CSP estricta (`scripts/build_static.js`, const `contentSecurityPolicy`) | Hay que **añadir el origen del chat a `connect-src`**. Es la única línea que se toca del sitio |
| Un único bundle JS con huella de contenido (`src/site-entry.js`) | El widget se añade como módulo importado ahí, no como `<script>` suelto |
| `npm run validate`, `validate_build.js`, `validate_acceptance.js` | El chatbot no puede romper ninguna validación |

## 3. Arquitectura elegida

La web y el chat son **dos despliegues independientes**. La web sigue en IONOS; el chat
vive en un Worker de Cloudflare bajo un subdominio propio.

```
 LOCAL (tu ordenador)                    CLOUDFLARE                      IONOS
 ────────────────────                    ──────────                      ─────

 content/kb/*.md                                                  public_html/
   │  (corpus, ya escrito)                                          ├── index.html …
   ▼                                                                └── assets/js/site-xxx.js
 npm run kb:index                                                        │  (widget dentro)
   │  scripts/build_kb_index.js                                          │
   ▼                                                                     │
 chat/src/kb-meta.json  ──┐                                              │
 chat/src/kb-vectors.bin ─┤                                              │
                          │  wrangler deploy                             │
                          ▼                                              │
                   chat.lardevies.com  ◄──── POST /chat ─────────────────┘
                     Worker (JS)                        (fetch del widget)
                       ├─► OpenAI (embedding + chat)
                       └─► D1 (log de conversaciones)
```

Flujo de una pregunta:

```
navegador (widget)
   │  POST https://chat.lardevies.com/chat  { sessionId, message, history }
   ▼
Worker
   ├─ 1. valida origen (CORS), tamaño y rate limit
   ├─ 2. reescribe la pregunta con el historial (llamada barata al LLM)
   ├─ 3. pide el embedding de la pregunta a OpenAI
   ├─ 4. búsqueda híbrida en el índice ya cargado en memoria (coseno + BM25 + RRF)
   ├─ 5. ¿mejor similitud < umbral?  ──► SÍ ► abstención SIN llamar al LLM
   ├─ 6. monta el CONTEXTO y llama al LLM con el prompt del sistema
   ├─ 7. guarda la conversación en D1
   └─ 8. responde { answer, sources, abstained }
```

## 4. Por qué esta arquitectura y no otra

**Índice en fichero, no Pinecone ni base de datos vectorial.** El corpus real son
**91 fragmentos** (17 documentos). A esa escala, una BD vectorial solo añade una cuenta
más, otra clave que rotar y 100–300 ms de latencia por consulta. El índice va embebido en
el propio Worker y se resuelve en memoria en menos de un milisegundo.

**Búsqueda híbrida (vectorial + léxica), no solo vectorial.** Las preguntas reales mezclan
lenguaje natural ("¿algo tranquilo para dos?") con términos exactos que la búsqueda
vectorial se salta ("La Panera", "hipoalergénicas", "TDT"). BM25 recupera lo segundo; el
embedding, lo primero.

**El umbral de abstención se aplica *antes* de llamar al LLM.** Es la defensa más
importante contra la invención: si ningún fragmento se parece lo bastante a la pregunta,
el LLM ni siquiera participa y se devuelve el mensaje de derivación. Un prompt puede
fallar; un `if` no.

**Backend propio en vez de un widget de terceros (Chatbase, Voiceflow…).** La CSP del
sitio prohíbe scripts externos, esos servicios meten cookies de terceros con implicaciones
RGPD, y sobre todo no permiten controlar el troceado ni la regla de abstención, que es
justo lo que hace que este bot no invente.

**Cloudflare Workers, no Vercel Hobby.** El plan Hobby de Vercel **restringe explícitamente
su uso a proyectos no comerciales**: *"the Hobby plan restricts users to non-commercial,
personal use only"* ([documentación de Vercel](https://vercel.com/docs/plans/hobby)), y su
definición de uso comercial cubre cualquier despliegue destinado al beneficio económico de
alguien implicado en el proyecto — que es exactamente el caso de un alojamiento que vende
noches. La alternativa legal sería Vercel Pro, 20 $/usuario/mes: veinte veces el coste de
la API de OpenAI para hacer el mismo trabajo. El plan gratuito de Cloudflare Workers ofrece
100.000 peticiones al día y su documentación de precios no impone esa restricción.

**Un solo lenguaje en todo el sistema.** El script de ingesta ya era Node. Con un backend
en JavaScript, el **tokenizador de BM25 se escribe una sola vez** y lo importan tanto la
ingesta como el Worker. En la versión anterior de este documento, con backend PHP, había
dos implementaciones del mismo normalizador y su desincronización habría degradado la
recuperación *en silencio*, sin ningún error visible. Esa costura desaparece.

**El chat aislado de la web.** Si alguien satura el endpoint, no consume recursos de IONOS:
la web no se puede caer por culpa del chat. Y al revés, el chat no depende de dónde esté
alojada la web.

## 5. Portabilidad: dos capas y un contrato

```
chat/src/index.js        ← CAPA DE PLATAFORMA (~100 líneas, desechable)
  · fetch handler de Workers, CORS y preflight
  · rate limit y escritura en D1
  · serialización de la respuesta

chat/src/core/           ← NÚCLEO (lógica pura, sin conocer Cloudflare)
  ├── normalizar.js      tokenizador COMPARTIDO con scripts/build_kb_index.js
  ├── indice.js          decodifica kb-meta.json + kb-vectors.bin
  ├── recuperar.js       coseno + BM25 + RRF + umbral + expansión a vecinos
  ├── prompt.js          monta el CONTEXTO y el prompt del sistema
  └── openai.js          llamadas HTTP a OpenAI (solo fetch estándar)
```

Regla: **el núcleo no toca `env`, D1, `Request` ni `Response`.** Recibe datos y devuelve
datos. Si algún día hay que mudarse (a Deno Deploy, a un VPS, a Vercel Pro, a Node en el
propio hosting), se reescribe `index.js` y nada más.

**El contrato es lo que hace portable el widget.** El widget nunca lleva la URL escrita a
fuego: la lee del atributo `data-chat-endpoint` del partial. Cambiar de backend es cambiar
ese atributo y una línea de la CSP.

```
POST <endpoint>
  { "sessionId": "uuid", "message": "texto", "history": [{"rol":"user|assistant","contenido":"…"}] }
→ 200 { "answer": "texto", "sources": [{"titulo":"…","url":"/suite-la-panera/"}],
        "abstained": false, "sessionId": "uuid" }
→ 4xx/5xx { "error": "codigo", "message": "texto para el usuario" }
```

## 6. Seguridad

| Riesgo | Mitigación |
|---|---|
| **Factura desbocada** por abuso | **Límite de gasto duro en la cuenta de OpenAI** (la única protección real) + rate limit de 20 mensajes / 10 min por IP en D1 + tope diario global que apaga el endpoint + regla de rate limiting del WAF de Cloudflare a nivel de zona |
| Robo de la clave de OpenAI | Vive en el almacén de secretos de Workers (`wrangler secret put`), cifrada y nunca en el repositorio ni en el bundle del navegador |
| Descarga del corpus completo | El índice va dentro del Worker: no es un fichero servible, no hay URL que lo exponga |
| Peticiones desde otros sitios | CORS con `Access-Control-Allow-Origin: https://lardevies.com` **exacto, nunca `*`**, y validación del header `Origin` en el Worker |
| Inyección de prompt (en la pregunta o dentro del corpus) | El bloque CONTEXTO se declara explícitamente como datos, no instrucciones. El modelo no tiene herramientas: lo peor que puede hacer es escribir texto |
| **HTML inyectado en la web vía la respuesta** | El widget inserta la respuesta con `textContent`, **nunca con `innerHTML`**. Los enlaces los construye el widget desde el campo `sources`, no parseando el texto del modelo |
| Inyección SQL en los logs | D1 con sentencias preparadas (`.bind()`), siempre |
| Entrada desmesurada | Mensaje ≤ 500 caracteres, historial ≤ 6 turnos, truncado duro antes de procesar |
| Datos personales en los logs | IP guardada como **hash con sal**, nunca en claro. Ver RGPD en `02` |
| Ataques de volumen | Cloudflare mitiga DDoS en el borde por defecto, antes de que el tráfico llegue a tu código |

**Lo que se abre respecto a la versión anterior**: la CSP deja de ser `connect-src 'self'`
y pasa a permitir también `https://chat.lardevies.com`. Es un origen concreto y propio, no
un comodín. A cambio, el aislamiento entre web y chat es total.

## 7. Coste

Estimación para **1.000 consultas al mes** con el corpus real (17 documentos, 91
fragmentos, ~8.000 tokens):

| Concepto | Cálculo | Coste |
|---|---|---|
| Cloudflare Workers | 1.000 peticiones/mes frente a 100.000/**día** incluidas | **0 €** |
| Cloudflare D1 (logs) | Muy por debajo del plan gratuito | **0 €** |
| Embeddings del corpus (`text-embedding-3-small`, ~0,02 $/1M tokens) | 8k tokens por reindexado | **~0,0002 $** cada vez |
| Embedding de cada pregunta | ~40 tokens × 1.000 | **<0,01 $** |
| Reescritura de consulta (modelo mini) | ~300 tokens × 1.000 | **~0,05 $** |
| Generación de la respuesta (modelo mini, ~2.500 entrada + 350 salida) | 1.000 respuestas | **~0,60 $** |
| **Total** | | **≈ 0,70 €/mes** |

> ⚠️ **Verificar antes de implementar.** Los identificadores de modelo y los precios de
> OpenAI cambian. Antes de escribir código, consulta la página de precios y modelos de
> OpenAI y fija el modelo de chat, el de embeddings y las dimensiones en `wrangler.toml`.
> En este documento son **parámetros**, no constantes.

### El límite que sí hay que vigilar: 10 ms de CPU

El plan gratuito de Workers da **10 ms de CPU por invocación**. No cuenta el tiempo de
espera de red, así que **los 1–3 segundos de OpenAI no computan**: solo tu cálculo.

- Coseno sobre 91 vectores de 512 dimensiones: ~47.000 multiplicaciones, bastante menos de
  1 ms. Sin problema.
- El riesgo está en el **arranque en frío**, al parsear el índice. Por eso el índice se
  parte en dos: `kb-meta.json` (textos y metadatos) y `kb-vectors.bin` (los vectores como
  Float32 contiguos), que se decodifica **una sola vez en el ámbito del módulo** y se
  reutiliza en todas las peticiones que atienda ese isolate.

Si aun así se quedara corto, el plan de pago de Workers son **5 $/mes** y elimina tanto el
límite de CPU como el tope diario. Sigue siendo cuatro veces más barato que Vercel Pro.

## 8. Requisito operativo: el DNS

Para servir el Worker en `chat.lardevies.com`, el dominio `lardevies.com` tiene que estar
gestionado como zona en Cloudflare, es decir, **apuntar los nameservers del dominio a
Cloudflare**. Es gratis, la web sigue alojada en IONOS exactamente igual (Cloudflare solo
resuelve el DNS y hace de proxy), y de paso obtienes CDN, certificado y WAF sin coste.

Alternativa si no quieres tocar el DNS: usar el subdominio gratuito
`lar-de-vies-chat.workers.dev` y añadirlo a la CSP. Funciona, pero queda atado a ese
dominio y algunas redes corporativas bloquean `workers.dev`. **Recomendado: mover el DNS**.

## 9. Decisiones cerradas

| Decisión | Elección |
|---|---|
| Web | Sigue en IONOS, estática, sin cambios salvo una línea de CSP |
| Backend | Cloudflare Worker en `chat.lardevies.com`, plan gratuito |
| Lenguaje | JavaScript en todo el sistema: ingesta y Worker comparten el normalizador |
| Índice | Embebido en el Worker (`kb-meta.json` + `kb-vectors.bin`) |
| Recuperación | Híbrida (coseno + BM25), fusión RRF, umbral de abstención previo al LLM |
| Corpus | 17 documentos Markdown en `content/kb/`, ya escritos |
| Idiomas | Detecta el idioma del usuario y responde en él; el corpus está en español |
| Alcance | Solo responder. Sin reservas, sin disponibilidad, sin captación de datos |
| Escalado | `reservas@lardevies.com` **y** `+34 678 655 303` |
| Logs | Conversación completa con fecha, en Cloudflare D1 (región europea), 12 meses |

## 10. Orden de trabajo

1. **Tú**: mover el DNS de `lardevies.com` a Cloudflare (§8) y crear la cuenta.
2. **ChatGPT, fase 1**: `scripts/build_kb_index.js` + índice.
3. **ChatGPT, fase 2**: el Worker (`chat/`).
4. **ChatGPT, fase 3**: D1 + textos legales.
5. **ChatGPT, fase 4**: widget, integración en el build y la línea de CSP.
6. **ChatGPT, fase 5**: set de evaluación y calibración del umbral.

Los cinco prompts están en `03-prompts-para-chatgpt.md`.
