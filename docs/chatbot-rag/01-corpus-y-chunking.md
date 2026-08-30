# 01 · Corpus, troceado e índice

> Documento 2 de 4. Define **qué sabe el bot y cómo se organiza ese conocimiento**.
> Es la parte que más determina la calidad de las respuestas: un corpus bien escrito con
> un RAG mediocre funciona; un corpus pobre con el mejor RAG del mundo, no.

## 1. Regla de oro

> **Si un dato no está en `content/kb/`, el bot no lo puede decir.**

No hay excepciones. No hay "conocimiento general" sobre casas rurales, ni deducciones del
tipo "si La Panera tiene secador, las demás también". Los precios, las políticas de
cancelación y la disponibilidad solo existen si están escritos, con su fecha de
actualización.

## 2. Estructura del corpus

Un fichero Markdown por entidad en `content/kb/`, con front-matter YAML:

```markdown
---
id: suite-la-panera            # identificador único, en kebab-case
titulo: Suite Panera           # nombre tal y como debe aparecer en la respuesta
url: /suite-la-panera/         # OPCIONAL: ruta canónica del sitio. Si está, debe
                               # existir en site.config.cjs. Los documentos transversales
                               # (estancia, servicios, gastronomía, contacto) no tienen
                               # página propia y la omiten: el bot no cierra con enlace.
entidad: lar-de-vies           # lar-de-vies | rural-prado | ambos
tipo: alojamiento              # alojamiento | politica | faq | entorno | servicio | contacto
capacidad: 4                   # opcional, solo en alojamientos
actualizado: 2026-08-28        # fecha de la última revisión del contenido
tags: [suite, casona, dosel, vistas al valle]
---

## Descripción
Texto en prosa, frases completas.

## Capacidad y camas
- Capacidad total: 4 personas
- ...
```

**Reglas de escritura del corpus** (importantes para que el troceado funcione):

1. **Frases completas y autocontenidas.** Nada de "Tiene 4" — escribe "La Suite Panera
   admite hasta 4 personas". Cada fragmento acabará viajando solo, sin su página alrededor.
2. **Repite el nombre del alojamiento dentro del texto**, no solo en el título. Ayuda a la
   búsqueda léxica y evita que el modelo confunda unas suites con otras.
3. **Una sección `##` por tema.** No mezcles equipamiento con política de mascotas.
4. **Nada de marketing vacío.** "Un refugio donde el tiempo se desacelera" no responde
   ninguna pregunta. Puede quedar en la descripción, pero los datos útiles (capacidad,
   camas, baño, wifi, mascotas) van en secciones propias y en formato de lista.
5. **Los datos que cambian llevan fecha**: precios, temporadas, horarios. Si no estás
   dispuesto a mantenerlos, no los pongas: el bot derivará al teléfono, que es correcto.
6. **Escribe también lo que NO hay.** "La Suite El Cabozo no tiene bañera, tiene ducha
   integrada" o "Ninguna villa dispone de piscina". Sin esto el bot se abstiene ante
   preguntas que sí tienen respuesta clara, y esas abstenciones innecesarias son la queja
   número uno de este tipo de asistentes.

## 3. El corpus actual

Escrito a partir del documento del cliente **"Lar de Víes · Base de conocimiento del
chatbot"** (16 páginas) y completado con los datos de capacidad y equipamiento de las
páginas del sitio. Son **17 ficheros**, que producen unos **91 fragmentos**:

| Fichero | `url` | Contenido |
|---|---|---|
| `sobre-lar-de-vies.md` | `/sobre-nosotros/` | Qué es, experiencia, los 8 alojamientos, animales, cerveza NEIPA, reseñas |
| `la-casona.md` | `/la-casona/` | La Casona, suites sin cocina, diferencia suite/villa, camas |
| `suite-la-capilla.md` | `/suite-la-capilla/` | Tres alturas, 4 pax, cama 1,50 m + altillo |
| `suite-la-panera.md` | `/suite-la-panera/` | Cama con dosel, zona de estar, 4 pax |
| `suite-el-cabozo.md` | `/suite-el-cabozo/` | Abuhardillada, 3 pax (la menor capacidad) |
| `suite-el-valle.md` | `/suite-el-valle/` | Planta baja, sala independiente, 4 pax |
| `suite-el-jardin.md` | `/suite-el-jardin/` | **La adaptada**: acceso y baño adaptados, 4 pax |
| `las-villas.md` | `/las-villas-casitas-independientes/` | Las tres villas, cocina equipada, diferencias |
| `villa-el-camino.md` | `/villa-el-camino/` | 60 m², dos plantas, 5 pax, **única con chimenea** |
| `villa-jazmin.md` | `/villa-jazmin/` | 45 m², una planta, 4 pax |
| `villa-camelia.md` | `/villa-camelia/` | 45 m², porche acristalado, 4 pax |
| `estancia.md` | — | Check-in/out, mascotas, niños, fumar, accesibilidad, camas |
| `servicios.md` | — | Wi-Fi, parking, coche eléctrico, climatización, pagos |
| `gastronomia.md` | — | Desayuno, cenas, menú, alergias, barbacoa, alternativas |
| `ubicacion-y-entorno.md` | `/el-entorno/` | Neipín, A Pontenova, As Catedrais, Taramundi, rutas |
| `reservas-y-cancelacion.md` | `/reservas/` | Cómo reservar, cancelación, qué alojamiento elegir |
| `contacto.md` | — | Email, teléfono, qué consultas requieren al equipo |

Más `_stopwords.json`, que no es corpus: lo consumen los tokenizadores (§7).

### Pendiente de decidir o completar

- **Rural Prado no está en el corpus.** El documento del cliente cubre solo Lar de Víes,
  pero la web tiene `/rural-prado/`. Mientras no haya contenido, el bot se abstendrá ante
  cualquier pregunta sobre Rural Prado, que es correcto pero puede resultar extraño a quien
  llegue desde esa página. Dos salidas: escribir `rural-prado.md`, o dejarlo así de forma
  deliberada.
- **Zonas comunes** (`/zonas-comunes/`): la web tiene página propia y el corpus solo la
  menciona de pasada. Merece su fichero si se reciben preguntas sobre el comedor o el salón.
- **Datos que el cliente no fijó**: número máximo de mascotas (deliberadamente abierto),
  precios y temporadas. No se han inventado: el bot deriva.

### Contradicción detectada entre el PDF y la web (resuelta)

En la **Suite Capilla**, el documento del cliente dice "cama principal de 1,50 m + dos camas
individuales de 90 cm en el altillo", mientras que la ficha de la web decía "King Size o
2 camas". **El cliente ha confirmado que la correcta es la del PDF**, así que se corrigió
[`suites/la-capilla.html`](../../suites/la-capilla.html): la ficha de comodidades pasa a
"1,50 m + 2 de 90 cm" y los párrafos de la descripción dejan de decir que el altillo tiene
"camas dobles". También se actualizó el `typeOfBed` del JSON-LD del fichero fuente, aunque
ese bloque no llega a producción (ver nota abajo).

Las demás suites mantienen "King Size o 2 camas", que coincide con la regla general del
documento del cliente (cama de 1,80 m o dos de 90 cm).

> **Nota al margen encontrada al corregirlo**: el JSON-LD `HotelRoom` que llevan las páginas
> fuente de suites y villas **nunca se publica**. `scripts/build_static.js:362` elimina todos
> los `script[type="application/ld+json"]` del origen y genera su propio grafo desde
> `site.config.cjs`, que no incluye datos por habitación. No afecta al chatbot, pero es
> código muerto y datos estructurados de habitación que Google no llega a ver.

## 4. Reglas de troceado (chunking)

Las aplica `scripts/build_kb_index.js`. Están calibradas para este corpus concreto: textos
cortos, muy estructurados y con mucho nombre propio.

| Regla | Valor | Por qué |
|---|---|---|
| Unidad base | **Una sección `##` o `###` = un chunk** | Las secciones ya son unidades temáticas; partir por número de caracteres rompe las listas de equipamiento por la mitad |
| Tamaño objetivo | **300–500 tokens** | Suficiente para una sección completa, corto para que el modelo no se distraiga |
| Tamaño máximo | **700 tokens** | Si se supera, se parte por párrafos completos, nunca a media frase |
| Tamaño mínimo | **80 tokens** | Por debajo, se fusiona con la sección hermana siguiente del mismo documento |
| Solapamiento | **0** | Con cabecera heredada no hace falta, y duplicar texto ensucia los resultados |
| Tablas y listas | **Nunca se parten** | Una lista de equipamiento cortada produce respuestas incompletas, que es una forma de inventar |
| FAQ | **Una pregunta + su respuesta = un chunk**, aunque sea corto | La pregunta escrita se parece muchísimo a la del usuario: es oro para la recuperación |
| Cruce de documentos | **Prohibido** | Un chunk nunca mezcla dos alojamientos |

### Cabecera heredada (obligatoria)

Cada chunk empieza con una línea de contexto generada automáticamente desde el
front-matter, porque el fragmento viajará solo:

```
Suite Panera — La Casona, Lar de Víes (A Pontenova, Lugo) · Capacidad: 4 · Equipamiento
```

Sin ella, un chunk que solo dice "- Secador individual en el baño" es irrecuperable e
inútil: el modelo no sabe de qué habitación habla.

### Metadatos por chunk

`id`, `doc`, `url`, `titulo`, `entidad`, `tipo`, `seccion`, `actualizado`, `posicion`
(índice de la sección dentro del documento, para poder expandir a los vecinos) y `tokens`.

## 5. El índice

`scripts/build_kb_index.js`, registrado en `package.json` como `kb:index`.

**Qué hace:**

1. Lee `content/kb/**/*.md` (ignora los ficheros que empiezan por `_`) y valida el
   front-matter: campos obligatorios, `url` existente en `site.config.cjs` cuando la haya,
   `actualizado` con formato de fecha. **Falla ruidosamente** si algo no cuadra — un corpus
   mal formado no debe llegar nunca a producción.
2. Trocea según §4 y genera las cabeceras heredadas.
3. Pide embeddings a OpenAI con **`text-embedding-3-small` y `dimensions: 512`**. Lotes de
   100, con reintento y espera exponencial.
4. **Cachea por hash del texto** en `node_modules/.cache/kb-embeddings/`: reindexar después
   de tocar un fichero solo factura ese fichero.
5. Calcula la parte léxica con el normalizador **compartido** (§7) y las estadísticas BM25
   (`df` por término, `idf`, longitud media). Todo lo pesado se precalcula aquí.
6. Escribe **dos ficheros** dentro del Worker, ambos versionados en git:
   - `chat/src/kb-meta.json` — textos, metadatos, tokens y estadísticas BM25.
   - `chat/src/kb-vectors.bin` — los 91 vectores como **Float32 contiguos**, en el mismo
     orden que los chunks de `kb-meta.json`.

**Por qué dos ficheros y no uno.** El plan gratuito de Workers da 10 ms de CPU por
invocación. Un único JSON con los vectores en base64 obligaría a decodificarlos en cada
arranque en frío; un binario plano se convierte en `Float32Array` de una sola pasada, en el
ámbito del módulo, y se reutiliza en todas las peticiones del mismo isolate. El vector del
chunk `i` es `VECTORES.subarray(i * 512, (i + 1) * 512)`.

**Formato de `kb-meta.json`:**

```json
{
  "version": 1,
  "modelo": "text-embedding-3-small",
  "dims": 512,
  "generado": "2026-08-28T10:00:00Z",
  "bm25": { "k1": 1.2, "b": 0.75, "avgdl": 84.3, "idf": { "panera": 4.11 } },
  "chunks": [
    {
      "id": "suite-la-panera#equipamiento",
      "doc": "suite-la-panera",
      "url": "/suite-la-panera/",
      "titulo": "Suite Panera",
      "entidad": "lar-de-vies",
      "tipo": "alojamiento",
      "seccion": "Equipamiento",
      "actualizado": "2026-08-28",
      "posicion": 2,
      "texto": "Suite Panera — La Casona… · Equipamiento
- Wifi
- …",
      "tokens": { "wifi": 1, "secador": 1 }
    }
  ]
}
```

Tamaños con el corpus real: `kb-meta.json` ~120 KB y `kb-vectors.bin` 182 KB exactos
(91 × 512 × 4 bytes). Muy por debajo del límite de bundle del Worker.

## 6. Recuperación (lo que ocurre en cada pregunta)

1. **Reescritura de la consulta.** Si hay historial, una llamada barata al modelo mini
   convierte "¿y ese tiene bañera?" en "¿La Suite Valle tiene bañera?" usando los 3 últimos
   turnos. Sin este paso fallan las preguntas de seguimiento, que son la mitad de una
   conversación real.
2. **Embedding de la consulta** reescrita, más su tokenización con el normalizador
   compartido.
3. **Búsqueda híbrida**: coseno sobre los vectores **y** BM25 sobre los tokens, fusionados
   con **Reciprocal Rank Fusion (k = 60)**. Se toman los **6 primeros**. El coseno recupera
   "¿algo tranquilo para dos?"; BM25 recupera "La Panera", "hipoalergénicas", "TDT".
   Ninguna de las dos por separado basta.
4. **Umbral de abstención**: si el mejor coseno < **0,35** (valor inicial, se calibra en la
   fase 5 de `03`), se devuelve el mensaje de derivación **sin llamar al LLM**. Es la
   defensa más fuerte contra la invención: un prompt puede fallar, un `if` no. Y de paso
   ahorra el coste de la llamada.
5. **Expansión a vecinos**: se añaden los chunks `posicion ± 1` del mismo documento, para
   que una sección partida no llegue coja. Tope duro: **8 chunks o ~2.500 tokens**.
6. **Montaje del CONTEXTO**: fragmentos numerados, cada uno con su título y su URL (o
   "(sin página)" si el documento no tiene `url`), para que el modelo pueda citar sin
   inventarse enlaces.

## 7. El normalizador, escrito una sola vez

El índice se construye en Node y las consultas se procesan en un Worker. **Ambos ejecutan
JavaScript**, así que el tokenizador de BM25 se escribe **una única vez** en
`chat/src/core/normalizar.js` (ESM) y lo importan los dos.

```
chat/src/core/normalizar.js
        ▲                    ▲
        │                    │
scripts/build_kb_index.js   chat/src/index.js
   (al construir)              (al consultar)
```

Esto no es un detalle de organización: en la versión anterior de esta especificación, con
el backend en PHP, había **dos implementaciones** del mismo normalizador. Si se
desincronizaban —un signo de puntuación tratado distinto, una stopword de más— BM25 dejaba
de encontrar cosas **en silencio**: sin errores, solo respuestas peores. Un único fichero
importado por los dos lados elimina esa clase de fallo por completo.

El normalizador es deliberadamente simple: minúsculas → quitar tildes (NFD y borrar
diacríticos) → sustituir todo lo que no sea `a-z0-9` por espacios → separar → descartar
tokens de un solo carácter → descartar las stopwords de `content/kb/_stopwords.json`.

Aun siendo uno solo, conviene un **test unitario** (`tests/kb/normalizar.test.js`) con unas
40 frases con tildes, ñ, mayúsculas, guiones, números y diéresis alemanas, para que un
cambio futuro no altere la tokenización sin darse cuenta: si cambia, hay que reindexar.

## 8. Mantenimiento

Actualizar lo que el bot sabe es siempre el mismo ciclo:

```bash
npm run kb:index
```

```bash
npm run kb:eval
```

```bash
cd chat && npx wrangler deploy
```

**La web no se toca**: no hay que reconstruirla ni volver a subirla a IONOS. El sitio y el
conocimiento del bot son despliegues independientes.
