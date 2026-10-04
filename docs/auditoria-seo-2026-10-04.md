# Auditoría SEO de Lar de Víes

Fecha: **4 de octubre de 2026**, Europe/Madrid. Dominio: [lardevies.com](https://lardevies.com/).

## Correcciones aplicadas después de la auditoría

El propietario ha solicitado **preparar la apertura de la web completa**. Se ha cambiado `site.maintenance` a `false`. Tras confirmar que Zonas comunes no pertenece a la web final, se ha retirado de las páginas generadas, los enlaces internos y el sitemap. Sus antiguas URLs, también en inglés y alemán, redirigen mediante 301 a La Casona en el idioma correspondiente. El paquete final `public/` contiene 54 páginas, 45 indexables y nueve páginas legales con `noindex`. El despliegue sigue pendiente; las observaciones HTTP que aparecen más abajo corresponden a la portada publicada al realizar la auditoría inicial.

Se han corregido los nombres propios en inglés y alemán, las fechas reales del sitemap, el texto del enlace de privacidad del chat y el validador SEO que buscaba un `.htaccess` antiguo. Las imágenes de cabecera tienen variantes AVIF con alternativa WebP, y el logo principal se prioriza. Rural Prado entrega ahora sus cinco galerías en el HTML inicial con imágenes adaptables, dimensiones y carga de la diapositiva visible; sus selectores táctiles tienen un área mayor. El build conserva las capacidades, las camas, los servicios y las coordenadas ya presentes en el JSON-LD de origen.

Se ha preparado la redirección Apache de `/index.html` condicionada a `THE_REQUEST`, para distinguir la solicitud externa de la resolución interna de DirectoryIndex. [Referencia de Apache](https://httpd.apache.org/docs/2.4/mod/mod_rewrite.html). La ejecución de esta regla en el servidor real debe verificarse después del despliegue.

`npm run build`, `npm run validate`, cuatro pruebas SEO (`npm run seo:test`), seis pruebas del pie, diez pruebas del sistema de lanzamiento y 14 pruebas de navegación/carruseles en móvil y escritorio pasan. También se comprobaron las 57 páginas sin JavaScript en Chrome móvil, sin fallos de contenido ni desbordamiento horizontal. Las pruebas SEO de apertura se ejecutan por separado para conservar la posibilidad de compilar paquetes de mantenimiento o lanzamiento programado.

Las páginas representativas medidas después de la corrección obtienen **100/100 en el SEO automático de Lighthouse**; no es una garantía de posiciones en Google. La última medición local de rendimiento móvil da 86 en la portada, 98 en La Casona, 97 en La Panera, 97 en El Camino, 96 en Entorno y 95 en Rural Prado; la portada en escritorio obtiene 100. Rural Prado reduce la transferencia inicial de 3.105.578 a 270.846 bytes, aproximadamente un **91 %**, y su LCP medido pasa de 3,31 a 2,56 segundos. Son mediciones de laboratorio sujetas a variación; no acreditan las métricas de usuarios reales y queda margen de mejora móvil.

Las evidencias posteriores están en [seo-fixes-2026-10-04](<C:/Users/eduar/Desktop/Lars ready/tmp/seo-fixes-2026-10-04>). El resto del documento conserva el diagnóstico original para poder comparar el antes y el después. No se han enviado URLs a buscadores ni se han completado comprobaciones autenticadas de Search Console o del Perfil de Empresa.

## Dictamen

**La web publicada está excluida de la indexación por su configuración de prelanzamiento.** Las 57 rutas canónicas responden con la portada temporal y `noindex, follow`. El sitemap público no contiene URLs. Robots.txt es accesible y permite el rastreo: el impedimento principal está en las páginas.

La web completa tiene una base técnica adecuada para publicarse: 57 páginas en español, inglés y alemán, 48 indexables y nueve páginas legales excluidas deliberadamente. Hay mejoras concretas en los nombres traducidos, el enlazado interno, las fechas del sitemap y el rendimiento móvil.

En la auditoría inicial no se publicó la web ni se desactivó el prelanzamiento. Se preservaron los cambios existentes y `public/`; la web completa se compiló entonces únicamente en una salida aislada. Las correcciones posteriores y la preparación de apertura se describen al principio de este documento.

## Alcance y evidencia

- 109 solicitudes HTTP a producción: 57 páginas canónicas, 35 rutas del mapa de redirecciones, dos rutas retiradas, controles de sitemap/robots/404, variantes de dominio y protocolo, recursos de la portada y una solicitud con User-Agent de Googlebot.
- Revisión de 19 páginas fuente y del 404; inspección del HTML compilado de 57 páginas.
- Comparación entre sitemap, canonical, indexabilidad, hreflang y archivos generados. Verificación de destinos internos y fragmentos, metadatos sociales e imágenes referenciadas por JSON-LD.
- Chrome móvil a 390 × 844: las 57 páginas sin JavaScript responden 200, muestran H1 y contenido principal y no desbordan horizontalmente. También se revisaron tres páginas con JavaScript.
- Lighthouse: seis páginas representativas en móvil y la portada en escritorio; dos repeticiones adicionales de la portada móvil.
- Validación del build de producción, HTML y aceptación HTTP local: correctas. La aceptación cubre también compresión, caché y rangos de vídeo 206/416.

Evidencia guardada en [la carpeta de auditoría](<C:/Users/eduar/Desktop/Lars ready/tmp/seo-audit-2026-10-04>): `live.json`, `local.json`, `browser.json`, `pages.csv`, informes Lighthouse, capturas móviles y scripts utilizados. Los datos HTTP corresponden aproximadamente a las **15:31 de Madrid**.

No se dispuso de acceso autenticado a Google Search Console, Bing Webmaster Tools, Google Business Profile, estadísticas de tráfico ni registros del servidor. Por tanto, no se certifican las URLs ya indexadas, sanciones, backlinks, posiciones, conversiones ni métricas reales de usuarios. Una búsqueda pública `site:` sin resultados no permite concluir que Google no tenga ninguna URL indexada.

## Estado del servidor publicado

| Comprobación | Resultado | Interpretación |
|---|---|---|
| 57 páginas canónicas | 200; `noindex, follow` en todas | Incompatibles con el objetivo de indexación actual |
| `/robots.txt` | 200; `text/plain`; `User-agent: *` y `Allow: /` | Sintaxis y acceso correctos; permite rastrear |
| `/sitemap.xml` | 200; XML; cero entradas | Deliberado durante prelanzamiento; no descubre contenido |
| HTTP → HTTPS | 301 | Correcto |
| www → dominio sin www | 301 | Correcto en las variantes comprobadas |
| URL inexistente de prueba | 404 | No devuelve un falso 200 |
| `/blog/` y `/excursiones-en-lugo/` | 410 | Retirada permanente configurada |
| Mapa de redirecciones | 34 de 35 responden con el 301 previsto | Excepción: `/index.html` responde 200 |
| URLs sin barra probadas | 301 hacia URL con barra | Correcto para `/la-casona`, `/en` y `/de` |
| Compresión HTML/XML | gzip | Activa |
| Caché HTML | Revalidación obligatoria | Permite recibir cambios tras publicar |
| Recursos CSS/logo de la portada | 200 | Accesibles |
| Solicitud con User-Agent de Googlebot | 200 y misma portada con `noindex` | No se observó trato diferente por ese identificador |

La petición que identifica Googlebot simula su User-Agent; no acredita acceso desde una IP real de Google. El TLS fue aceptado por el cliente HTTP en HTTPS, incluido www; esto no constituye una auditoría completa de certificados.

### Robots.txt: respuesta concreta

El archivo publicado es:

```text
User-agent: *
Allow: /
```

Es válido. Que permita rastrear no anula el `noindex` del HTML. [Google distingue expresamente rastreo e indexación](https://developers.google.com/search/docs/crawling-indexing/robots/intro).

Al compilar la web completa se genera otro robots.txt que permite Google y Bing mediante el grupo `*`, declara `https://lardevies.com/sitemap.xml`, permite los bots de búsqueda configurados y bloquea GPTBot/ClaudeBot. No bloquea CSS, JavaScript ni imágenes. La ausencia de un grupo explícito `Googlebot` en esa salida es válida: se aplica el grupo general.

El robots.txt de la raíz del repositorio no es el archivo que se publica en el flujo actual: el build genera el de `public/`. Editar únicamente el archivo raíz no garantiza un cambio en producción.

## Hallazgos y acciones por prioridad

### 1. Prioridad alta: exclusión de todas las páginas por prelanzamiento

Evidencia: `site.config.cjs` tiene `maintenance: true`, `launchAt: null`; la plantilla temporal incluye `noindex`. Producción confirma el mismo estado en las 57 rutas.

Cuando se decida abrir la web, cambiar `maintenance` a `false`, compilar y desplegar el resultado. Verificar después por HTTP que las páginas comerciales devuelven 200 con contenido completo y sin `noindex`, y que el sitemap contiene 48 URLs. Comprobar también que ninguna variable de CI fuerza `SITE_MAINTENANCE=true` ni el entorno `preview`.

La portada actual responde a una decisión de producto y no se ha eliminado en esta auditoría. Si el prelanzamiento debe durar y el dominio tenía visibilidad previa, conviene valorar conservar una portada informativa indexable y contenido útil. Mantener toda la web con `noindex` puede hacer que las URLs existentes salgan del índice. [Google explica las consecuencias de cerrar una web y las alternativas para conservar presencia](https://developers.google.com/search/docs/crawling-indexing/pause-online-business).

### 2. Prioridad media: nombres propios traducidos en las páginas de alojamiento

El H1 de Rural Prado aparece como **«Rural / Meadow»** en inglés y **«Ländlich / Wiese»** en alemán, aunque el título y los datos estructurados identifican el alojamiento como Rural Prado. Se confirmó en Chrome y en las capturas móviles.

Los diccionarios también convierten El Camino en The Way/Der Weg, Camelia en Camellia/Kamelie y Jazmín en Jasmine/Jasmin. Conviene preservar los nombres comerciales en encabezados, enlaces y textos alternativos y traducir sus descripciones. Esto mantiene coherencia entre página, reservas y entidad del alojamiento.

Archivos implicados: `locales/en.json`, `locales/de.json`, `OtrosAlojamientos.html` y la traducción del build. Revisar los nombres como unidades completas, porque Rural y Prado están separados en el HTML.

### 3. Prioridad media: Zonas comunes carece de enlaces entrantes

`/zonas-comunes/`, `/en/zonas-comunes/` y `/de/zonas-comunes/` están en el sitemap y tienen canonical correcto, pero no se alcanzan siguiendo enlaces HTML desde la portada. Los componentes compartidos sustituyen la navegación original y no incorporan esa página.

Añadir un enlace contextual desde La Casona y, si encaja, desde las fichas de suites o el pie. La página puede descubrirse por el sitemap, pero su relación con los alojamientos queda mejor expresada con enlaces internos. Su contenido principal es breve, aproximadamente 72 palabras en español: ampliar información útil y comprobada sobre los servicios favorecería la claridad, sin fijar un mínimo artificial de palabras.

### 4. Prioridad media: fechas `lastmod` desactualizadas

Las 48 URLs indexables llevan `2026-08-11`. Hay modificaciones posteriores confirmadas en Git; por ejemplo, el commit `4aedbd5` del 29 de septiembre actualiza información de alojamientos. El valor coincide con el manifiesto, pero no refleja esas modificaciones.

Actualizar `lastModified` para las páginas con cambios significativos reales y gestionar, si procede, fechas por idioma. No cambiar todas las fechas automáticamente en cada despliegue. [Google utiliza `lastmod` cuando refleja modificaciones verificables del contenido](https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap).

### 5. Prioridad media: optimización de imágenes y carga móvil

Cuatro páginas medidas superan el objetivo de LCP de 2,5 s en la prueba local: La Panera, El Camino, Entorno y Rural Prado. La mayor oportunidad está en Rural Prado: la prueba carga aproximadamente 3 MB y Lighthouse estima 1,6 MiB de ahorro en imágenes.

Revisar tamaños de imágenes de galería, `srcset`/`sizes`, compresión y carga de diapositivas fuera de vista. En la portada, Lighthouse identifica el logo como elemento LCP y señala que carece de `fetchpriority="high"`; verificar si priorizarlo mejora la carga sin competir con recursos esenciales.

Estas mediciones corresponden a un build local con simulación móvil. Deben repetirse sobre la web completa publicada y contrastarse con datos de usuarios reales. [Los Core Web Vitals de Google contemplan LCP, INP y CLS](https://developers.google.com/search/docs/appearance/core-web-vitals).

### 6. Prioridad baja: texto genérico del enlace del chat

El enlace a `/politica-privacidad/#asistente-virtual` se llama «Más información». Es la única comprobación SEO automática suspendida en los siete informes Lighthouse iniciales; las páginas obtienen 92/100 en esa categoría.

Cambiar el texto visible por «Privacidad del asistente virtual» y traducirlo. El destino y fragmento existen. Este detalle no impide indexar y 92/100 no debe interpretarse como una puntuación global de posicionamiento.

Archivo: `src/templates/partials/chat-widget.njk`.

### 7. Prioridad baja: controles táctiles de Rural Prado

Lighthouse señala los puntos selectores de sus carruseles por tamaño o separación insuficientes. La accesibilidad automática queda en 96/100, frente a 100 en las otras páginas medidas. Ampliar el área pulsable conservando el tamaño visual del punto.

### 8. Prioridad baja: `/index.html` sirve un duplicado de la portada

En producción responde 200; el generador omite su redirección Apache por un riesgo documentado de bucle con DirectoryIndex. Tras abrir la web, el canonical de la portada completa apunta correctamente a `/`, lo que reduce el problema.

Si se desea una redirección, condicionarla a una solicitud externa explícita de `/index.html` mediante `THE_REQUEST` y probarla en Apache. No introducir un Redirect simple que pueda afectar la resolución interna del índice. Es una mejora de normalización y no un bloqueo de lanzamiento.

### 9. Prioridad media del proceso: el validador SEO raíz no comprueba el artefacto actual

`npm run validate` falla con «Falta .htaccess para IONOS», porque el script busca un `.htaccess` en la raíz. El flujo actual genera `public/.htaccess`, que existe y cuyas reglas están actuando en producción. Los validadores del build completo y de HTML sí pasan.

Actualizar el validador para distinguir fuentes y artefacto publicado y revisar robots/sitemap/metadatos generados. No añadir un `.htaccess` antiguo solo para satisfacer el test. Conviene incorporar una comprobación explícita del modo esperado: un build de mantenimiento puede pasar sus validaciones y seguir siendo no indexable por diseño.

### 10. Datos estructurados: correctos como JSON, con oportunidades y límites

Todas las páginas completas contienen JSON-LD que se analiza correctamente. Hay WebSite, WebPage/AboutPage, LodgingBusiness, Accommodation y BreadcrumbList, según la página. Las referencias a imágenes existen en el paquete; Lar de Víes incluye dirección y teléfono.

Rural Prado tiene una entidad separada, pero no incluye dirección ni teléfono: el código explica que esos datos no están confirmados. Su JSON puede ser válido en Schema.org y aun así no cumplir las propiedades requeridas para un resultado enriquecido de negocio local. Confirmar sus datos antes de ampliarlo. [Consultar los requisitos de LocalBusiness de Google](https://developers.google.com/search/docs/appearance/structured-data/local-business).

El build sustituye el marcado de origen y simplifica los alojamientos: no conserva las coordenadas de Lar de Víes ni las capacidades y camas presentes en algunas fuentes. Es una oportunidad de enriquecerlo con datos confirmados. No se ha verificado la elegibilidad mediante Rich Results Test; el test JSON local no la sustituye. Tampoco este marcado garantiza disponibilidad, precios, estrellas ni botones de reserva en Google.

## Resultados de rendimiento

Lighthouse local, Chrome sin interfaz, simulación móvil. La portada móvil muestra la mediana de tres ejecuciones; las demás páginas tienen una ejecución.

| Página | Dispositivo | Rendimiento | SEO automático | LCP | CLS |
|---|---|---:|---:|---:|---:|
| Inicio | Móvil | 84 | 92 | 2,11 s | 0,000 |
| La Casona | Móvil | 100 | 92 | 1,58 s | 0,001 |
| Suite La Panera | Móvil | 94 | 92 | 2,86 s | 0,003 |
| Villa El Camino | Móvil | 93 | 92 | 3,08 s | 0,003 |
| El Entorno | Móvil | 97 | 92 | 2,63 s | 0,000 |
| Rural Prado | Móvil | 91 | 92 | 3,31 s | 0,019 |
| Inicio | Escritorio | 99 | 92 | 0,49 s | 0,000 |

La portada móvil obtuvo 82, 88 y 84 en rendimiento, con TBT de 640, 411 y 556 ms. La tarea dominante de la traza está atribuida a `_lighthouse-eval.js`, instrumentación del propio auditor. Por eso no se atribuye ese bloqueo directamente al JavaScript de la web ni se concluye que exista un problema real de INP. Hace falta medir la publicación con datos de campo para resolverlo.

## Comprobaciones correctas en la web completa

- 57 canonical absolutos y coherentes con sus rutas, sin duplicados.
- 48 páginas comerciales/contenido con `index, follow`; nueve páginas legales con `noindex, follow` y fuera del sitemap.
- 48 entradas de sitemap, todas correspondientes a páginas indexables, sin duplicados ni fechas futuras.
- Alternativas es/en/de/x-default coherentes en HTML y sitemap; destinos existentes y reciprocidad de las páginas.
- Título, descripción y un H1 por página. Las 57 descripciones son únicas.
- Ocho títulos coinciden entre sus variantes inglesa y alemana. Se revisaron: expresiones como «Suite La Panera in A Pontenova» son válidas en ambos idiomas. Esa coincidencia entre versiones equivalentes no constituye por sí sola un error.
- Sin destinos internos ni fragmentos rotos encontrados en las páginas canónicas compiladas. Las tres páginas de Zonas comunes se detectan como páginas sin enlace entrante.
- Atributo `alt` y dimensiones presentes en las imágenes HTML; textos alternativos vacíos se usan en imágenes decorativas.
- Imágenes sociales y de JSON-LD disponibles en el paquete generado.
- HTML completo servido inicialmente: no necesita JavaScript para presentar su contenido principal.
- HTML válido según la configuración del proyecto; CSS/JS con nombres por huella de contenido y recursos de imagen optimizados.

Una descripción alemana, la de Sobre nosotros, tiene 181 caracteres y podría mostrarse recortada. Es una mejora editorial menor, no una infracción de una longitud máxima obligatoria. Google puede seleccionar otros textos o modificar títulos y fragmentos según la consulta. [Títulos](https://developers.google.com/search/docs/appearance/title-link) y [descripciones](https://developers.google.com/search/docs/appearance/snippet).

## Pasos de lanzamiento y verificación externa

1. Resolver los nombres propios y el enlace a Zonas comunes; actualizar fechas reales de cambios y optimizar las imágenes con mayor ahorro.
2. Publicar el build completo cuando se acuerde abrir la web. La configuración actual no tiene fecha de apertura automática.
3. Verificar en producción las 48 URLs comerciales: contenido final, 200, canonical al dominio correcto y ausencia de `noindex` tanto en HTML como en `X-Robots-Tag`.
4. Confirmar robots.txt con el sitemap final de 48 URLs. Mantener las redirecciones de las URLs antiguas y revisar el tratamiento de las rutas retiradas si los datos reales muestran tráfico o enlaces relevantes.
5. En Google Search Console, verificar la propiedad de dominio, enviar el sitemap y usar Inspección de URL para la portada, La Casona, una suite, una villa y Rural Prado. Revisar indexación, canonical seleccionada, rastreo, acciones manuales y seguridad. No encontrar una etiqueta de verificación en HTML no demuestra que falte la propiedad: puede verificarse por DNS.
6. En Bing Webmaster Tools, verificar el sitio y enviar el sitemap. IndexNow existe como opción del proyecto, pero no se enviaron notificaciones en esta auditoría.
7. Comprobar y mantener los datos del Perfil de Empresa de Google: nombre, dirección, teléfono, categoría, enlace web y reservas. La página de Rural Prado necesita sus datos propios confirmados. Estas cuentas no se inspeccionaron.
8. Ejecutar Rich Results Test sobre la publicación y PageSpeed Insights en móvil/escritorio. Consultar Core Web Vitals reales cuando exista una muestra suficiente de usuarios.

Cumplir los requisitos técnicos facilita el rastreo y la indexación; no garantiza una posición concreta ni que todas las URLs se incluyan en los resultados. El impedimento comprobado hoy es la exclusión deliberada por `noindex` de toda la web publicada.
