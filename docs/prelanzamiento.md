# Portada de prelanzamiento

La configuración `site.maintenance: true` en `site.config.cjs` publica únicamente el logo, el mensaje «El comienzo de algo nuevo» y el selector de reservas de Lar de Víes y Rural Prado. Los enlaces salen a los motores de reserva definidos en `properties` en ese mismo archivo.

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
