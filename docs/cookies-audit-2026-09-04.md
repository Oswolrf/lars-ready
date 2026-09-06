# Revisión de cookies — 4 de septiembre de 2026

## Cambio editorial posterior solicitado

Por petición del titular, la política se ha redactado después en presente («Utilizamos Google Analytics 4»), en los tres idiomas, para su futura puesta en servicio. Esto modifica únicamente la redacción: Analytics sigue sin estar instalado y los pendientes técnicos descritos abajo siguen vigentes. El inventario siguiente conserva los resultados de la revisión original; la redacción de la política no es prueba de activación ni de cumplimiento del consentimiento. Antes de publicarla debe corresponder con la instalación real.

## Alcance y resultado

Se ha actualizado la política de la **nueva web local** en español, inglés y alemán. Google Analytics 4 figura como incorporación prevista, no como servicio activo. No se ha instalado Analytics, modificado el consentimiento ni publicado ningún cambio.

La revisión comprende código propio, HTML de las 57 rutas generadas, recursos integrados, una inspección visual de la política local y consultas HTTP públicas. **No constituye un inventario exhaustivo de cookies de terceros en un navegador limpio**: faltan capturas de almacenamiento y tráfico antes del consentimiento, tras rechazar, tras aceptar y tras revocar, con distintas políticas de cookies de terceros. Una petición HTTP sin `Set-Cookie` no demuestra ausencia de cookies en una visita completa.

## Inventario de la nueva web

| Elemento | Evidencia | Finalidad y duración actuales |
| --- | --- | --- |
| `lar-de-vies-cookie-consent-v1` | `js/cookie-consent.js:6`, `:12`, `:26` | `localStorage`, no cookie. Elección de análisis, necesarias y fecha. Sin caducidad ni renovación automática. |
| `lar-de-vies-chat-session-v3-es`, `-en`, `-de` | `js/chat-widget.js:19`, `:83`, `:149`, `:223` | `sessionStorage`, no cookie. Estado del asistente, mensajes recientes, contexto y token de historial. Se escribe al inicializar, incluso antes de conversar. Sesión de pestaña; la restauración del navegador puede prolongarla. |
| Google Maps | `index.html:622`, `Entorno.html:834` | Iframes de `maps.google.com`, con `src` real y `loading="lazy"`. La carga diferida no es un bloqueo por consentimiento. Cookies concretas no verificadas; no atribuir automáticamente NID, SOCS u otras a todas las visitas. |
| Brevo / sibforms.com | `js/newsletter.js:11`, función `warmRuntime`, observador con margen de 800 px; formulario del footer | Script del formulario y envío de suscripción. Se precarga por proximidad o interacción, sin consultar consentimiento de análisis. No se identifica el rastreador de marketing de Brevo en el código propio. |
| GA4 | Búsqueda del código propio y scripts generados | No se encuentra etiqueta de GA, GTM ni identificador de medición. `_ga` y `_ga_<id>` se documentan como previsión, no como hallazgos. |
| Reservas y redes sociales | Footer y modal de reservas | Enlaces externos a Direct Book, Instagram, Facebook y YouTube. No se identifican reproductores YouTube ni píxeles sociales en la nueva web. Un enlace no prueba instalación de cookies. |
| Tipografías y vídeos | `scripts/build_static.js:460`, `:733`; HTML generado | Fuentes y vídeos servidos localmente. Los enlaces antiguos a Google Fonts se eliminan durante la compilación. |

La revisión del JavaScript propio no encontró escrituras mediante `document.cookie`. No se deben presentar localStorage y sessionStorage como cookies HTTP ni afirmar por ello que toda la web está libre de cookies.

## Comprobaciones HTTP

- Inicio local: HTTP 200, sin cabecera `Set-Cookie` en la respuesta consultada.
- Script público `https://sibforms.com/forms/end-form/build/main.js`: HTTP 200, sin `Set-Cookie`; no aparecieron los literales `document.cookie`, `localStorage`, `sessionStorage`, `visitor_id` o `sib_cuid` en la versión consultada. Esto no descarta llamadas indirectas, recursos posteriores ni cookies durante el envío del formulario. No se envió ninguna suscripción.
- `https://lardevies.com/`: HTTP 200, sin `Set-Cookie` en esa respuesta. **El dominio publicado sirve otra web, basada en WordPress/Elementor**, con un iframe `https://www.youtube.com/embed/BdO-M_jQVE8`. No aparecieron indicadores de GA/GTM en el HTML principal, pero no se auditó exhaustivamente su JavaScript ni sus plugins. El inventario local no debe aplicarse a esa versión antigua. Su vídeo incrustado requiere revisión propia; no basta con tratar YouTube como un enlace.

## Pendientes antes de activar Analytics

1. Conectar realmente la carga y el envío de Analytics con el consentimiento. El evento `lar-de-vies:cookie-consent` se emite, pero no tiene un consumidor de Analytics. El banner por sí solo no bloquea una etiqueta añadida aparte. Comprobar también las peticiones sin cookies: ausencia de cookies no equivale a ausencia de envío de datos.
2. Añadir acceso permanente para reabrir preferencias y una retirada efectiva. El panel actual desaparece al guardar y no se crea si existe una elección previa. Borrar datos del navegador no debe ser el único mecanismo ofrecido por la web.
3. Revalidar elecciones previas cuando se incorporen nuevas finalidades o proveedores. La guía de la AEPD recomienda renovar a intervalos apropiados y considera buena práctica no superar 24 meses de validez; el código actual no comprueba la fecha guardada.
4. Revisar Maps y la precarga de Brevo: no obedecen a la opción de análisis. Verificar qué almacenamiento y peticiones generan; aplicar consentimiento por finalidad o carga a petición cuando corresponda. No asumir que todas sus operaciones son analíticas o necesarias.
5. Revisar la escritura anticipada del estado del chat y valorar inicializar su almacenamiento cuando se solicite el asistente, en lugar de dar por supuesta la excepción de necesidad para todo su uso.
6. Ajustar la Content Security Policy al método de instalación elegido. Actualmente `script-src` y `connect-src` en `vercel.json` y `scripts/build_static.js` no permiten los orígenes de Analytics. Mantener los cambios sincronizados, sin abrir comodines generales.
7. Confirmar ID de medición, proveedor contractual, caducidad efectiva de cookies, retención de eventos, Google Signals/publicidad y posibles transferencias. Actualizar la política y la información de privacidad con la configuración real. No se presume activación de Google Ads.
8. Dirigir la información del banner a la política de cookies: actualmente enlaza a privacidad. Revisar coherencia de ambos textos y de las opciones visibles. Validar jurídicamente la versión final antes de publicarla.

## Verificación de los cambios

- `npm run build`: correcto, 57 rutas y validaciones HTML/aceptación.
- `node --test tests/cookie-policy.test.cjs tests/footer.test.cjs`: 9 pruebas correctas. Inventario, traducciones completas de la política, enlaces y contratos del footer.
- `git diff --check`: sin errores de espacios; avisos de conversión LF/CRLF propios del entorno.
- Política local revisada en el navegador: contenido y enlaces presentes, sin desbordamiento horizontal en el viewport de escritorio observado. No se certifica el comportamiento del consentimiento mediante estas pruebas.

## Fuentes oficiales

- [Cookies y valores predeterminados de GA4](https://developers.google.com/analytics/devguides/collection/ga4/tag-options): `_ga` y `_ga_<container-id>`, 2 años por defecto y duración configurable.
- [Cookies de Google](https://policies.google.com/technologies/cookies?hl=es): contexto sobre almacenamiento del proveedor; no constituye evidencia de instalación en este sitio.
- [Transferencias de datos de Google](https://policies.google.com/privacy/frameworks?hl=es).
- [Privacidad de Brevo](https://www.brevo.com/legal/privacypolicy/).
- [Guía sobre el uso de las cookies de la AEPD, mayo de 2024](https://www.aepd.es/guias/guia-cookies.pdf), apartados 3.2.7 a 3.2.9 sobre cambios, actualización y retirada.
