# Auditoría de preparación para publicación — 12/08/2026

## Veredicto

El bloqueo visual del menú móvil de la portada quedó corregido y protegido con pruebas funcionales y visuales. La web queda técnicamente preparada para el despliegue final.

## Recorrido revisado

1. Portada en escritorio — saludable.
2. Selector de alojamiento en escritorio — funcional.
3. Portada en móvil — saludable.
4. Menú móvil de la portada — corregido: overlay opaco, fondo oculto e inerte, foco contenido y cierre con Escape.
5. Página de reservas en móvil — saludable.
6. Menú móvil en la página de reservas — saludable; confirma que el defecto está ligado a la portada/mapa.

## Evidencias

- `01-inicio-desktop.png`
- `02-selector-reserva-desktop.png`
- `03-inicio-mobile.png`
- `04-menu-mobile.png`
- `05-reservas-mobile.png`
- `06-menu-mobile-reservas.png`
- `../tests/e2e/visual.spec.js-snapshots/inicio-menu-375-chromium-win32.png` — estado corregido.

## Verificaciones automáticas

- Build de producción: correcto; 18 rutas canónicas verificadas.
- HTML, SEO, activos, reservas, redirecciones y cabeceras: correctos.
- E2E: 197 pruebas superadas, 51 omitidas por diseño, 0 fallos.
- Navegadores: Chromium, Firefox, WebKit/Safari y perfil móvil.
- Axe: sin violaciones graves o críticas en las 18 rutas probadas.
- Lighthouse: 98–100 en móvil y 100 en escritorio en las rutas principales; LCP, CLS y TBT dentro de presupuesto.

## Comprobaciones finales de despliegue

1. Verificar dominio, HTTPS y cabeceras sobre la URL pública.
2. Realizar una reserva de prueba y confirmar una suscripción real de Brevo. Esas acciones externas no se ejecutaron en esta auditoría.

## Mantenimiento no bloqueante

- Actualizar periódicamente la base `caniuse-lite` de Browserslist.
