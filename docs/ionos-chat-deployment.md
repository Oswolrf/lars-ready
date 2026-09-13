# Publicar la web en IONOS y el chatbot en Vercel

> Alternativa anterior. La adaptación actual elegida es [Supabase Edge Functions](supabase-chat-deployment.md).

Estado: código preparado; el subdominio propuesto no se considera activo hasta verificar DNS, HTTPS y una conversación real. No se han cambiado servicios remotos.

## 1. Servidor independiente

Desde la raíz del proyecto, con Node 24 y dependencias instaladas:

```powershell
npm run rag:test
npm run chat:test:browser
npm run chat:prepare
```

El paquete se genera en `.cache/chat-server`: contiene el servidor, dependencias bloqueadas y configuración de Vercel. No incluye `.env.local`, claves, imágenes ni páginas. Regenerarlo después de modificar `api/chat.js` o dependencias. No editar la copia generada.

Crear un proyecto separado de Vercel, propiedad del cliente, a partir de ese directorio (CLI `vercel` desde `.cache/chat-server`). Elegir un proyecto nuevo, no enlazarlo al proyecto de la web. Usar el preset Other, Node 24, instalación `npm ci --omit=dev`, sin comando de build y salida `public`, según el `vercel.json` incluido. La raíz `/` puede devolver 404: la ruta de servicio es `/api/chat` y solo admite POST/OPTIONS. Confirmar un plan adecuado para uso comercial y sus límites antes de activarlo.

En las variables del servidor configurar para Production (y Preview si se va a probar allí):

| Variable | Valor |
|---|---|
| `OPENAI_API_KEY` | Clave privada de la cuenta del cliente |
| `SUPABASE_URL` | URL del proyecto que contiene la información del chatbot |
| `SUPABASE_SECRET_KEY` | Clave privada del servidor |
| `CHAT_HISTORY_SECRET` | Secreto aleatorio de al menos 32 bytes; conservar el existente si ya se usa |
| `RAG_ALLOWED_ORIGINS` | `https://lardevies.com,https://www.lardevies.com` |
| `RAG_CHAT_MODEL` | Modelo configurado actualmente en `.env.example`, o el acordado |
| `RAG_EMBEDDING_MODEL` | El mismo modelo empleado para indexar los documentos |

Reutilizar la base de conocimiento existente: cambiar el alojamiento no exige reindexar ni migrar los datos. Confirmar que el proyecto dispone de las funciones de búsqueda y de límite de uso que necesita el servidor. No poner estas claves en IONOS ni en JavaScript del navegador. CORS no sustituye el control de abuso; conservar el límite de peticiones y configurar alertas de consumo.

Añadir `chat.lardevies.com` en Domains del proyecto Vercel y crear en IONOS únicamente el registro DNS que indique Vercel para ese subdominio. No modificar el dominio principal ni MX/TXT del correo. Esperar validación DNS y certificado HTTPS. El endpoint de producción debe ser público para visitantes, sin una pantalla de autenticación de Vercel; comprobar Deployment Protection. Desplegar Production desde el paquete con `vercel --prod` una vez configuradas las variables; los cambios de variables requieren un nuevo despliegue.

## 2. Compilar para IONOS

Volver a la raíz del proyecto:

```powershell
$env:SITE_ORIGIN = 'https://lardevies.com'
$env:BASE_PATH = '/'
$env:CHAT_API_URL = 'https://chat.lardevies.com/api/chat'
npm run build
npm run adapters:check
```

El build lee estas variables del proceso; no carga `.env.local` automáticamente. `CHAT_API_URL` es una dirección pública, nunca una clave. La compilación inserta el endpoint en todos los idiomas y permite su origen en `connect-src` de los adaptadores generados, incluido `public/.htaccess`. Subir el contenido de `public` a una carpeta nueva de IONOS, incluido ese archivo oculto. No reemplazarlo por el `.htaccess` de la raíz ni utilizar las cabeceras del `vercel.json` de la web para IONOS.

El build por defecto sigue usando `/api/chat` cuando `CHAT_API_URL` no está definido. Para volver al despliegue conjunto:

```powershell
Remove-Item Env:CHAT_API_URL -ErrorAction SilentlyContinue
npm run build
```

## 3. Pruebas antes de sustituir la web

Probar primero en un subdominio de IONOS con HTTPS, protegido de indexación. Añadir su origen exacto temporalmente a `RAG_ALLOWED_ORIGINS` y volver a desplegar el servidor. Usar `npm run build:preview` para esa copia. El build definitivo debe ser de producción, sin noindex ni restricciones de acceso de las pruebas.

- Verificar que OPTIONS devuelve 204 y `Access-Control-Allow-Origin` contiene el origen exacto de la web. Un origen no autorizado debe recibir 403.
- En el navegador, enviar un saludo, una pregunta sobre un alojamiento y otra de seguimiento; probar español, inglés y alemán, y abrir las fuentes de las respuestas.
- Comprobar que POST responde sin bloqueo de CORS/CSP, devuelve historial firmado y no requiere autenticación de Vercel.
- Probar desde móvil y verificar que un fallo de conexión muestra la alternativa de contacto.
- Comprobar también reservas, newsletter y redirecciones bajo Apache; las validaciones locales no prueban las restricciones del hosting IONOS.

No cambiar el destino del dominio principal hasta superar estas pruebas. Tras el cambio, repetir desde `https://lardevies.com`, retirar de la lista los orígenes temporales y comprobar logs y consumo. Conservar web anterior y despliegue anterior del servidor para poder volver atrás por separado.

## 4. Qué falta para activar

Acceso al proyecto Vercel y DNS de IONOS, variables privadas del servidor, confirmación del subdominio y prueba real contra los servicios externos. El paquete local no acredita por sí solo disponibilidad remota ni consumo contratado.

Referencias: [Node.js en Vercel](https://vercel.com/docs/functions/runtimes/node-js), [variables de entorno](https://vercel.com/docs/environment-variables), [CORS](https://vercel.com/kb/guide/how-to-enable-cors).
