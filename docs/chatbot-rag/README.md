# Chatbot RAG de Lar de Víes — especificación

Asistente para lardevies.com que responde **solo** con la información del corpus, en el
idioma del visitante, y deriva a `reservas@lardevies.com` / `+34 678 655 303` cuando no
tiene la respuesta. Estos cuatro documentos son la especificación completa: están escritos
para que ChatGPT los lea y construya el sistema.

| Documento | Contenido |
|---|---|
| **[GUIA-IMPLEMENTACION.md](GUIA-IMPLEMENTACION.md)** | **Empieza aquí.** Paso a paso de cero a producción: cuentas, DNS, comandos, verificaciones y resolución de problemas |
| [00-arquitectura.md](00-arquitectura.md) | Qué se construye, restricciones, decisiones, portabilidad, seguridad y coste (~0,70 €/mes) |
| [01-corpus-y-chunking.md](01-corpus-y-chunking.md) | El corpus, reglas de troceado, formato del índice y recuperación |
| [02-backend-y-widget.md](02-backend-y-widget.md) | El Worker, contrato JSON, CORS, CSP, D1, RGPD y widget |
| [03-prompts-para-chatgpt.md](03-prompts-para-chatgpt.md) | El prompt del sistema literal y los cinco prompts por fases |

## Arquitectura en una línea

La web sigue **estática en IONOS**; el chatbot es un **Cloudflare Worker independiente** en
`chat.lardevies.com` que habla con la API de OpenAI. Dos despliegues separados: actualizar
el conocimiento del bot no toca la web, y el chat no puede tumbar el sitio.

## Estado

**El corpus ya está escrito**: 17 documentos en [`content/kb/`](../../content/kb/), unos 91
fragmentos, redactados a partir del documento del cliente *"Lar de Víes · Base de
conocimiento del chatbot"* y completados con los datos de las páginas del sitio. Falta
decidir dos cosas, anotadas en `01`, §3: si se cubre **Rural Prado** (el documento del
cliente no lo trata) y si se añade un fichero de **zonas comunes**.

Lo que aún no existe: la ingesta, el Worker, la base de datos y el widget. Los construye
ChatGPT con los prompts de `03`.

## Por dónde seguir

Sigue [GUIA-IMPLEMENTACION.md](GUIA-IMPLEMENTACION.md), que ordena todo el trabajo. En
resumen:

1. **Mover el DNS de `lardevies.com` a Cloudflare** (gratis; la web sigue en IONOS). Es el
   requisito para servir el Worker en `chat.lardevies.com` — ver `00`, §8.
2. Haz la prueba rápida del prompt del final de `03`: cinco minutos, sin código, y valida el
   tono antes de que quede incrustado en el backend.
3. Pásale a ChatGPT los cinco prompts de `03`, en orden, sin saltarte los criterios de
   "hecho".

## Antes de desplegar

- Verifica los identificadores de modelo y los precios de OpenAI: cambian con el tiempo y
  aquí están tratados como parámetros, no como constantes.
- Pon un **límite de gasto duro** en la cuenta de OpenAI. Es la única protección real contra
  una factura desbocada.
- Vigila el **consumo de CPU por invocación** en el panel de Cloudflare: el plan gratuito da
  10 ms (no cuenta la espera de OpenAI). Si se quedara corto, el plan de pago son 5 $/mes.
