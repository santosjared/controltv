import type { Television } from "../types";

export type PlaybackSelection = { id: string; name: string; kind: "PLAYLIST" | "VIDEO" | "IMAGE" };
export type PlaybackAction = "prepare" | "start" | "resume" | "stop" | "shuffle" | "repeat";
export const PLAYBACK_EVENTS = ["media.play", "media.pause", "media.stop", "media.volume", "media.repeat", "media.show", "media.hide", "media.shuffle"] as const;
export type PlaybackEvent = typeof PLAYBACK_EVENTS[number];
export type PlaybackCommand = { evento: PlaybackEvent; datos: { request_id: string; tv_ids: string[]; auto_reproducir?: boolean; playlist_id?: string; contenido_id?: string; tipo?: "VIDEO" | "IMAGEN"; repetir?: boolean; aleatorio?: boolean; volumen?: number } };

export function selectedPlaybackTargets(devices: Television[], selectedIds: string[]): string[] {
  const selected = new Set(selectedIds);
  return [...new Set(devices.filter((tv) => selected.has(tv.id) && (tv.connectionStatus === "online" || tv.connectionStatus === "low-signal")).map((tv) => tv.tvCode ?? tv.id))];
}

export function buildSocketCommand(evento: PlaybackEvent, tvIds: string[], fields: Record<string, unknown>, requestId: string): PlaybackCommand {
  if (!PLAYBACK_EVENTS.includes(evento)) throw new Error("Acción no válida.");
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(requestId)) throw new Error("El request_id debe ser un UUID.");
  const ids = [...new Set(tvIds.map((id) => id.trim()).filter(Boolean))];
  if (!ids.length || ids.length > 100) throw new Error("Selecciona entre 1 y 100 televisores en línea.");
  const datos: PlaybackCommand["datos"] = { request_id: requestId, tv_ids: ids };
  if (evento === "media.play" || evento === "media.show") {
    if (fields.playlist_id && fields.contenido_id) throw new Error("No se puede enviar playlist_id y contenido_id juntos.");
    if (fields.playlist_id || fields.contenido_id) datos.auto_reproducir = fields.auto_reproducir === true;
    if (fields.playlist_id) datos.playlist_id = String(fields.playlist_id);
    if (fields.contenido_id) datos.contenido_id = String(fields.contenido_id);
    if (fields.tipo !== undefined) {
      if (fields.tipo !== "VIDEO" && fields.tipo !== "IMAGEN") throw new Error("Tipo de contenido inválido.");
      datos.tipo = fields.tipo;
    }
  }
  if (evento === "media.repeat") {
    if (typeof fields.repetir !== "boolean") throw new Error("Repetir debe ser verdadero o falso.");
    datos.repetir = fields.repetir;
  }
  if (evento === "media.shuffle") {
    if (typeof fields.aleatorio !== "boolean") throw new Error("Aleatorio debe ser verdadero o falso.");
    datos.aleatorio = fields.aleatorio;
  }
  if (evento === "media.volume") {
    if (!Number.isInteger(fields.volumen) || Number(fields.volumen) < 0 || Number(fields.volumen) > 100) throw new Error("El volumen debe ser un entero de 0 a 100.");
    datos.volumen = Number(fields.volumen);
  }
  return { evento, datos };
}

export function buildPlaybackCommand(action: PlaybackAction, tvIds: string[], selection: PlaybackSelection | null, requestId: string, enabled?: boolean): PlaybackCommand {
  if ((action === "start" || action === "prepare") && !selection?.id.trim()) throw new Error("Selecciona una playlist, un video o una imagen.");
  const source = action === "resume" ? {} : selection?.kind === "PLAYLIST" ? { playlist_id: selection.id } : selection ? { contenido_id: selection.id, tipo: selection.kind === "IMAGE" ? "IMAGEN" : "VIDEO" } : {};
  const event = (action === "start" || action === "prepare") ? selection?.kind === "IMAGE" ? "media.show" : "media.play" : action === "resume" ? "media.play" : action === "stop" ? "media.stop" : action === "shuffle" ? "media.shuffle" : "media.repeat";
  return buildSocketCommand(event, tvIds, { ...source, auto_reproducir: action === "start", repetir: enabled, aleatorio: enabled }, requestId);
}
