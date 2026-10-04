# Portada de prelanzamiento

## Estado preparado para la apertura — 04/10/2026

Por indicación del propietario, `site.maintenance` está ahora en `false` y `launchAt` sigue en `null`. El próximo despliegue de `public/` publicará la web completa: 54 páginas y un sitemap con 45 URLs indexables. Zonas comunes se ha retirado de la web final y sus antiguas URLs redirigen a La Casona. No hay una fecha programada. La explicación siguiente describe cómo volver a generar la portada si fuera necesario.

La configuración `site.maintenance: true` y `site.launchAt: null` en `site.config.cjs` publica únicamente el logo, el mensaje «El comienzo de algo nuevo» y el selector de reservas de Lar de Víes y Rural Prado. Los enlaces salen a los motores de reserva definidos en `properties` en ese mismo archivo. Sin una fecha acordada no aparece un contador provisional ni se abre automáticamente la web.

El selector funciona con ratón, teclado y JavaScript desactivado. Las páginas en español, inglés y alemán y las rutas antiguas muestran la portada temporal; `/reservas/` abre directamente las dos opciones. No se carga el chat, analítica, vídeos ni navegación de la web completa. Las páginas temporales llevan `noindex` y un sitemap vacío.

## Publicar la portada

Ejecutar `npm run build`. El resultado queda en `public/`, la carpeta que utiliza el flujo actual de IONOS Deploy Now. Para publicarlo hay que hacer commit y push al repositorio y rama conectados a IONOS. Editar los archivos locales no actualiza producción.

## Lanzar la web completa

1. Cambiar `maintenance: true` por `maintenance: false` en `site.config.cjs`.
2. Ejecutar `npm run build`.
3. Hacer commit y push a la rama conectada a IONOS y comprobar el despliegue.

Se regeneran automáticamente todas las páginas, el sitemap, las directivas de indexación y los recursos de la web completa. Los originales nunca se sustituyen por la portada.

Para una comprobación local sin cambiar el ajuste, PowerShell permite:

```powershell
$env:SITE_MAINTENANCE='false'
npm run build
Remove-Item Env:SITE_MAINTENANCE
```

La variable `SITE_MAINTENANCE`, si está definida, tiene prioridad sobre el archivo y solo admite `true` o `false`. No debe quedar activada en CI cuando se quiera lanzar la web completa.

## Cuenta atrás y apertura programada

El sistema está preparado, pero la fecha y la zona horaria del servidor permanecen sin configurar. No hay un lanzamiento programado en el repositorio.

Cuando se acuerde la fecha:

1. Mantener `maintenance: true` y establecer `site.launchAt` como fecha ISO 8601 con segundos y desplazamiento horario explícito. Interpretar la hora del propietario en `Europe/Madrid`: el desplazamiento cambia entre invierno y verano. No introducir una fecha sin zona ni calcular el desplazamiento a partir del horario de hoy.
2. Confirmar la zona IANA del reloj local del servidor Apache de IONOS y establecer `site.launchServerTimeZone`. No asumir que el servidor usa Madrid ni UTC. El build rechaza una fecha futura si este dato no está configurado. Puede confirmarse con el proveedor o por SSH; en una prueba en staging, comparar la cabecera `X-Launch-Server-Time` con `Date` convertido a la zona configurada. No publicar la programación definitiva hasta comprobar que coinciden.
3. Ejecutar `npm run build`, `npm run launch:test` y publicar `public/`, incluido su `.htaccess`, antes de la fecha elegida. Verificar en IONOS una programación de ensayo: portada y sitemap vacío antes, web normal y sitemap completo después, también sin JavaScript. La prueba local simula el servidor; no ejecuta Apache ni acredita la configuración del hosting remoto.

El build con fecha futura prepara las 54 páginas de la web completa en sus rutas habituales y una copia de la portada con contador en `__prelaunch/`. Las reglas temporales de `.htaccess` entregan la portada antes del lanzamiento y, desde el segundo previsto, dejan de intervenir. La web completa, sus metadatos de indexación y su sitemap quedan activos sin recompilar ni redesplegar en ese momento. Las rutas antiguas y retiradas vuelven a sus redirecciones y respuestas habituales al abrir la web.

El contador mantiene el diseño de la portada y traduce días, horas, minutos y segundos a español, inglés y alemán. Se sincroniza con la cabecera `Date` de un recurso del propio servidor, consulta si la apertura está activa y lleva las pestañas abiertas a su página e idioma originales, conservando parámetros y fragmento de URL. El endpoint de estado y la portada previa no se guardan en caché. Una falta de conexión mantiene las reservas accesibles y vuelve a comprobar la apertura al recuperar la conexión, sin un bucle de recargas.

Con JavaScript desactivado se muestran la fecha y las reservas. El servidor abre igualmente la web a la hora configurada; una pestaña ya abierta necesita recargarse para recibirla. Si se compila después de la fecha programada, se genera directamente la web completa.

Esta programación está diseñada para el hosting Apache actual de IONOS. Los adaptadores estáticos de Vercel, Netlify y Nginx no ejecutan estas reglas: no trasladarles un build programado sin adaptar primero la apertura del servidor. Referencias: [IONOS y `.htaccess`](https://docs.ionos.space/docs/deploy-static-sites/), [reglas de Apache](https://httpd.apache.org/docs/2.4/mod/mod_rewrite.html) y [condiciones por petición](https://httpd.apache.org/docs/2.4/mod/core.html#if).

Para pruebas locales se pueden usar `SITE_LAUNCH_AT` y `SITE_LAUNCH_SERVER_TIME_ZONE`, que tienen prioridad sobre el archivo. Una cadena vacía en `SITE_LAUNCH_AT` desactiva la programación y conserva la portada si el mantenimiento sigue activo. La fecha no debe quedar definida en CI como ensayo. `SITE_MAINTENANCE=false` permite publicar inmediatamente la web completa, aunque exista una fecha futura.

Para cambiar o cancelar una programación ya publicada hay que actualizar la configuración y redesplegar; editar únicamente el archivo local no cambia el servidor. Una fecha que caiga en una hora repetida por el cambio de horario del servidor se rechaza para evitar una apertura anticipada.

## Revisión de cambios previos — 29/09/2026

Al comenzar había 23 archivos modificados sin commit en `ionos-deploynow` (141 inserciones y 101 eliminaciones):

- Ocho fichas de suites y villas: Valle y Jardín pasan de cuatro a tres personas; Capilla aclara dos adultos y dos niños de hasta 17 años; se concretan las camas y supletorias de las villas y las configuraciones de las suites.
- Diez documentos de `content/kb/`: llevan esas mismas correcciones al corpus del asistente.
- `locales/en.json` y `locales/de.json`: añaden las traducciones de los textos nuevos.
- `site.config.cjs` y `scripts/apply_seo_updates.js`: ajustan descripciones SEO, ocupación y camas a las fichas corregidas.
- `css/chat-widget.css`: baja el botón del chat cuando no hay barra de reserva fija; conserva espacio sobre esa barra en móviles.

Se han conservado todos esos cambios. Las seis pruebas del corpus pasan. Los cambios del corpus requieren actualizar la ingesta RAG si se desea que el asistente publicado utilice la nueva información: el despliegue estático por sí solo no actualiza la base vectorial.

Tras actualizar el remoto, la rama local y `corporate/main` coincidían en `4aa10fc`. El 404 inicial se resolvió seleccionando la cuenta `osialegal`, ya autenticada en GitHub CLI; no fue necesario renovar las credenciales. La ingesta RAG es independiente de la publicación de esta portada.

Se detecta además un fallo previo de `npm run validate`: el validador SEO exige un `.htaccess` en la raíz, mientras que esta rama genera `public/.htaccess` durante el build. La verificación de producción debe hacerse con `npm run build`, que comprueba la salida publicada.

Este fallo se ha corregido el 04/10/2026: `npm run validate` comprueba también el build generado, exige el entorno de producción por defecto y detecta una portada de mantenimiento cuando se espera la web completa. Las cuatro pruebas de regresión SEO de apertura se ejecutan con `npm run seo:test`, por separado para conservar los builds de mantenimiento y lanzamiento programado.
