# Conexión local al backend

- Backend: `http://localhost:3000`, endpoint confirmado `GET /tvs`.
- En `.env`: `API_BASE_URL=http://localhost:3000` (solo servidor).
- Las transferencias con progreso usan `/api/tvs/.../transferencias` en el mismo origen; Next.js agrega el token HTTP-only al llamar al backend.
- Socket.IO namespace: `NEXT_PUBLIC_SOCKET_URL=http://localhost:3000/tvs`.
- En Render configura `APP_URL=https://controltv.onrender.com`. La ruta que entrega el token del socket acepta ese origen y el host reenviado por el proxy de Render.
- Para un despliegue separado en Render usa `API_BASE_URL=https://TU-BACKEND.onrender.com` y `NEXT_PUBLIC_SOCKET_URL=https://TU-BACKEND.onrender.com/tvs`. `NEXT_PUBLIC_SOCKET_URL` se incorpora durante el build, por lo que debes redeplegar después de cambiarla. Mantén `AUTH_COOKIE_SECURE=true` en HTTPS.
- Único evento Socket.IO escuchado: `admin.message`.
- Arranca Next.js en otro puerto: `pnpm dev --port 3001`.
- Reinicia Next.js tras modificar `.env`. `.env.example` contiene la configuración de ejemplo.

El navegador usa RTK Query → `/api/tvs` de Next.js → `/tvs` del backend.
La ruta de Next.js evita CORS y tiene un tiempo límite de 10 segundos. También reenvía las operaciones del CRUD.
El store se crea por instancia de Provider, sin singleton compartido entre solicitudes.

Se muestran carga, errores con reintento y lista vacía. No se sustituyen respuestas
vacías o errores con datos de demostración. La consulta se repite al recuperar foco
o conexión.

`GET /tvs` es la fuente autoritativa de los televisores registrados. Socket.IO solo
aporta presencia y dispositivos pendientes mediante `admin.message`. Para
`evento: "devices.status"`, `datos.enline` y `datos.low_sengal` contienen referencias
`{ tv_id }`; toda TV registrada ausente de ambas listas se considera desconectada.
Una TV en `low_sengal` también cuenta como conectada, con alerta amarilla.

Para `evento: "devices.pending"`, `datos.pendientes_registro` contiene objetos
`{ tvId, ip, model, version_android }`. Cada mensaje actualiza únicamente la parte
del estado a la que corresponde, sin mezclar pendientes con televisores registrados.

Las imágenes y videos se transfieren como `multipart/form-data` (campo `file`) a
`POST /tvs/:tv_id/transferencias`. Al terminar el HTTP, la interfaz espera en
`admin.message` un mensaje `evento: "media.lista"` para el mismo `tv_id`, con
`estado: "LISTO_PARA_REPRODUCIR"`. Hasta esa confirmación, los controles permanecen
ocultos y se muestra un indicador de espera. Los videos habilitan reproducción,
pausa, volumen y detener; las imágenes habilitan la acción de mostrar en pantalla.

Las órdenes usan exclusivamente `admin.message` con `{ evento, datos }`.
Cada clic genera `request_id` y un solo mensaje con `tv_ids` (1–100 TVs), incluso
para una TV. La conexión envía `auth.token` y exige `tvs.control`. Las confirmaciones
`media.result` se correlacionan por petición, TV y acción, con resultados parciales.
El frontend no presupone éxito al emitir. Ver [socket-playback.md](socket-playback.md).

Los elementos recibidos por Socket.IO se muestran como notificaciones pendientes,
no como televisores registrados. El registro envía a `POST /tvs/register` exactamente
`tv_id`, `model`, `version_android`, `ip`, `nombre`, `sala` y `ubicacion`. El botón Identificar
TV es únicamente visual hasta que el backend exponga un endpoint o evento para esa orden.
La interfaz exige `nombre`, aunque el DTO del backend lo declara opcional. Respeta los límites
del DTO: 100 caracteres para modelo, versión, sala y nombre; 200 para ubicación, además del
patrón `TV-XXXXXXXX-XXX` en hexadecimal mayúscula para `tv_id`.

El adaptador de `GET /tvs` admite el contrato registrado con `id`, `tv_id`, `nombre`,
`model`, `version_android`, `ip`, `ultimo_contacto`, `sala` y `estado`.

Las imágenes y videos se envían directamente como `multipart/form-data`, campo `file`,
a `POST /tvs/:tv_id/transferencias`. La conexión directa permite mostrar el progreso
real de subida, por lo que el backend HTTP debe permitir el origen del panel mediante CORS.
El cliente admite solamente imagen o video y limita cada archivo a 100 MB.

Los formatos de envío y recepción para playlists, videos e imágenes están en
[socket-playback.md](socket-playback.md). Ese contrato conserva `admin.message` y
los controles existentes y el formato agrupado con `tv_ids`, `request_id` y
resultados individuales `media.result`, confirmado por el backend.

Para levantar el stack con Docker Compose, consulta `docs/docker.md` en el repositorio `controltv-backend`. En Docker, Socket.IO usa `/tvs` y Nginx reenvía `/socket.io/`; no se graba localhost en el bundle.
