# Contrato Socket.IO de reproducción confirmado por el backend

- Namespace: `/tvs` (URL en `NEXT_PUBLIC_SOCKET_URL`).
- Canal único de envío/recepción: `admin.message`.
- Sobre: `{ "evento": "...", "datos": { ... } }`.
- Autenticación: `auth: { token: accessToken }`, permiso backend `tvs.control`.
- El alias de interfaz para ese permiso es `televisions.control`.

## Autenticación del panel

El hook obtiene el token de su sesión con `POST /api/auth/socket-token`.
La ruta valida/renueva la sesión y devuelve el token con `Cache-Control: no-store`.
Solo se conserva en memoria; no se guarda en localStorage ni en archivos.
Se revisa su vigencia periódicamente, antes de caducar y al recuperar el foco.
Cuando cambia, se cierra el socket anterior y se conecta otro con el nuevo token.
Las órdenes pendientes interrumpidas se marcan con error y no se reenvían automáticamente.

```javascript
const socket = io(`${BACKEND_URL}/tvs`, {
  auth: { token: accessToken }
});
socket.on("admin.message", procesarMensaje);
```

## Presencia: backend → panel

El backend publica una instantánea al conectar y cuando cambia la presencia.
Reemplaza por completo la instantánea anterior.

```json
{
  "evento": "devices.status",
  "datos": {
    "enline": [{ "tv_id": "TV-001" }, { "tv_id": "TV-002" }],
    "low_sengal": [{ "tv_id": "TV-003" }]
  }
}
```

Las TVs registradas ausentes de ambas listas están desconectadas. Las de señal
baja también cuentan como conectadas. Los registros se cargan con `GET /tvs`
paginado; el socket aporta la presencia y los estados de reproducción.

El frontend solicita presencia al conectar/reconectar:

```json
{ "evento": "devices.status.request", "datos": {} }
```

## Órdenes: panel → backend

Cada clic genera un UUID `request_id`. Se emite **un mensaje** con un array `tv_ids`
de 1 a 100 códigos únicos, incluso para una sola TV. Nunca se envía `tv_id` junto
con `tv_ids`. Las TVs se seleccionan entre las conectadas.

```json
{
  "evento": "media.play",
  "datos": {
    "request_id": "64c9725a-8411-4516-9d45-189e2a66a016",
    "tv_ids": ["TV-001", "TV-002"],
    "playlist_id": "UUID-PLAYLIST"
  }
}
```

| Acción | Evento | Campos adicionales a `request_id` y `tv_ids` |
| --- | --- | --- |
| Iniciar playlist | `media.play` | `playlist_id` |
| Iniciar video | `media.play` | `contenido_id`, `tipo: "VIDEO"` |
| Mostrar imagen | `media.show` | `contenido_id`, `tipo: "IMAGEN"` |
| Reanudar | `media.play` | Ninguno |
| Pausar | `media.pause` | Ninguno |
| Detener | `media.stop` | Ninguno |
| Ocultar imagen | `media.hide` | Ninguno |
| Repetir | `media.repeat` | `repetir`: booleano |
| Aleatorio | `media.shuffle` | `aleatorio`: booleano |
| Volumen | `media.volume` | `volumen`: entero de 0 a 100 |

Nunca enviar juntos `playlist_id` y `contenido_id`. Los controles individuales
utilizan también arrays de un elemento y un UUID nuevo. Los botones de reanudar,
pausar, detener, repetir, aleatorio y volumen actúan sobre la reproducción actual.

```json
{
  "evento": "media.repeat",
  "datos": {
    "request_id": "b74c0390-c978-4ded-9963-928db7d35af3",
    "tv_ids": ["TV-001"],
    "repetir": false
  }
}
```

Los archivos siguen por HTTP. Socket.IO comunica únicamente órdenes, referencias
y estados; el backend resuelve el contenido/playlist y prepara los enlaces para la TV.

## Resultados: backend → panel

La TV devuelve el `request_id` después de aplicar la acción. El backend comunica
un resultado independiente por TV al panel que hizo la petición.

```json
{
  "evento": "media.result",
  "datos": {
    "request_id": "64c9725a-8411-4516-9d45-189e2a66a016",
    "tv_id": "TV-001",
    "accion": "media.play",
    "ok": true
  }
}
```

```json
{
  "evento": "media.result",
  "datos": {
    "request_id": "64c9725a-8411-4516-9d45-189e2a66a016",
    "tv_id": "TV-002",
    "accion": "media.play",
    "ok": false,
    "code": "TV_OFFLINE",
    "message": "La TV no está conectada"
  }
}
```

El frontend registra cada solicitud y cada TV como pendiente antes de emitir.
Valida `request_id`, destinatario y acción; ignora respuestas ajenas o duplicadas.
No cambia reproducción, volumen, repetición ni aleatorio al emitir. Aplica el
resultado confirmado y escucha también los eventos de estado del backend.
Las solicitudes terminan cuando todas sus TVs tienen resultado; puede haber
éxitos y fallos dentro del mismo grupo.

Códigos backend: `FORBIDDEN`, `TV_OFFLINE`, `CONTENT_NOT_FOUND`,
`PLAYLIST_NOT_FOUND`, `DOWNLOAD_FAILED`, `INVALID_COMMAND`, `PLAYBACK_FAILED`,
`PLAYBACK_TIMEOUT`, `COMMAND_PENDING`.

El backend devuelve `PLAYBACK_TIMEOUT` a los 30 segundos si la TV no confirma.
Como protección si se pierde ese mensaje, el frontend cierra pendientes tras 35
segundos. Al perder el socket cierra los pendientes con `CONNECTION_LOST`,
conserva los éxitos/errores recibidos y no reenvía las órdenes.

## Error del sobre de una petición

```json
{
  "evento": "media.error",
  "datos": {
    "request_id": "64c9725a-8411-4516-9d45-189e2a66a016",
    "code": "INVALID_COMMAND",
    "message": "tv_ids debe contener entre 1 y 100 códigos"
  }
}
```

Si incluye `request_id`, se rechazan los destinatarios todavía pendientes de esa
petición. Si el sobre era tan inválido que no hay identificador, se muestra el
error general sin asignarlo a otra solicitud.

## Estados para sincronizar paneles

Se siguen recibiendo por `admin.message` los eventos `media.play`, `media.pause`,
`media.stop`, `media.show`, `media.hide`, `media.repeat`, `media.shuffle` y
`media.volume`, con `tv_id` individual y los valores finales:

```json
{
  "evento": "media.shuffle",
  "datos": { "tv_id": "TV-001", "aleatorio": true }
}
```

```json
{
  "evento": "media.play",
  "datos": { "tv_id": "TV-001", "playlist_id": "UUID-PLAYLIST" }
}
```

Estos estados actualizan la TV sin dar por finalizada una petición: la resolución
por solicitud depende de `media.result`. Se conservan `media.lista`,
`media.lista.error` y `devices.pending` para preparación de medios y registro.

## Verificación

`pnpm test:playback`: envío agrupado/individual, UUID por petición, autenticación,
reconexión al rotar token, presencia, resultados parciales, duplicados, errores,
timeouts y ausencia de cambios optimistas. Las pruebas no usan TVs reales.

## Controles locales de la TV

La TV aplica el control local y publica por admin.message el mismo evento,
con datos.tv_id y origen: "tv", sin request_id. Ejemplo:

```json
{ "evento": "media.pause", "datos": { "tv_id": "TV-001", "origen": "tv" } }
```

El backend valida que el socket pertenezca a esa TV, guarda el estado y lo publica
solo a los administradores autorizados. No reenvía la acción a la TV. Los controles
locales que reemplazan órdenes remotas pendientes las finalizan con CANCELLED.
Las respuestas atrasadas de esas órdenes no deben revertir el estado del panel.
Las confirmaciones remotas conservan request_id y utilizan media.result.

Al conectar/reconectar el panel se recibe devices.status y el estado guardado de
cada TV, con volumen, repetición y aleatorio. Los eventos confirmados son la fuente
del estado; media.result resuelve la petición sin inferir ni sobrescribir ese estado.
La TV descarga por HTTP directo a archivos temporales, verifica Content-Length y
publica media.progress. El panel muestra ese avance y espera hasta 15 minutos,
renovando la espera con cada avance real.
