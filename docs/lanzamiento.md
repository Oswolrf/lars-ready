# Lanzamiento de la web completa

Estado a 6 de octubre de 2026. El destino es IONOS (Apache); `vercel.json` no se utiliza para publicar.

## Antes de publicar

1. **Google Analytics.** Crear la propiedad GA4 y copiar el ID de medición (`G-XXXXXXXXXX`) en
   `analyticsMeasurementId` de `site.config.cjs`. También puede pasarse con la variable `GA_MEASUREMENT_ID`
   al compilar. Con el ID vacío no se publica ningún código de Analytics ni se abren orígenes de Google en la CSP.
   Los *previews* nunca llevan Analytics. La política de cookies ya describe GA4 como activo, así que **no se
   debe publicar sin ID**.
2. **Search Console.** Lo más sencillo es una propiedad de dominio verificada con un registro TXT en el DNS: no
   requiere cambios en el código. Si se elige «prefijo de URL» con etiqueta HTML, copiar el valor de `content` en
   `googleSiteVerification` (o `GOOGLE_SITE_VERIFICATION`); se añade solo en la portada de cada idioma.
3. Compilar: `npm run build`. Genera `public/` con las validaciones HTML, SEO y aceptación.
4. Comprobar `npm run validate`, `npm run seo:test`, `npm run adapters:check` y `node --test tests/footer.test.cjs tests/cookie-policy.test.cjs`.

## Publicar (jueves)

La publicación se hace con IONOS Deploy Now desde GitHub: cada push a la rama conectada ejecuta
`.github/workflows/Lardevies-orchestration.yaml`, que compila con `npm ci && npm run build` y despliega `public/`.
Esos workflows están en `corporate/main` (osialegal/Lardevies); `public/` está en `.gitignore` y no se sube a mano.

**Interruptor de apertura:** `Lardevies-build.yaml` define `SITE_MAINTENANCE: true` en el paso de build. Esa variable
tiene prioridad sobre `maintenance` de `site.config.cjs`, así que mientras siga en `true` la web seguirá mostrando la portada
de prelanzamiento aunque el código esté listo. Para abrir la web, cambiarla a `false` (o borrar la línea), hacer push y esperar al despliegue.

No usar `IONOS-LISTO/WEB-PARA-SUBIR`, que es una copia antigua con `noindex`.

## Después de publicar

- `https://lardevies.com/` debe mostrar la web completa, con `index, follow`, y `/sitemap.xml` debe listar 45 URLs.
- `https://lardevies.com/index.html` debe redirigir con 301 a `/`: es una regla Apache que solo se puede verificar en el servidor real.
- Search Console: enviar `https://lardevies.com/sitemap.xml` e inspeccionar/solicitar indexación de la portada.
- Analytics: aceptar cookies en una ventana privada y comprobar en Tiempo real que aparece la visita; rechazar y
  comprobar que no se carga `googletagmanager.com` ni se crean cookies `_ga`.
- En GA4 (Administrador → Recopilación de datos), desactivar Google Signals y dejar la retención de eventos en 14 meses.
- El pie de página incluye «Preferencias de cookies», que reabre el panel para cambiar o retirar el consentimiento.
  La elección caduca a los 24 meses.

## Pendiente fuera del lanzamiento

- El asistente virtual no conoce las correcciones de ocupación y camas hasta ejecutar `npm run rag:ingest`
  (escribe en la base de producción de Supabase).
- Google Maps y el formulario de Brevo se cargan sin depender del selector de análisis; están descritos en la política de cookies.
