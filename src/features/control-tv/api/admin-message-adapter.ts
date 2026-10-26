import type { ConnectedTvDto } from "./tv-adapter";
import type { PlaybackEvent } from "./playback-protocol";
import { PLAYBACK_EVENTS } from "./playback-protocol";
import type { PlaybackResult } from "./playback-requests";

type DeviceReference = { tv_id: string };

export type DevicesStatusMessage = {
  type: "status";
  onlineTvIds: string[];
  lowSignalTvIds: string[];
};

export type PendingDevicesMessage = {
  type: "pending";
  devices: ConnectedTvDto[];
};

export type MediaReadyMessage = {
  type: "media-ready";
  tvId: string;
  content: Record<string, unknown>;
  status: "LISTO_PARA_REPRODUCIR";
};

export type MediaListErrorMessage = {
  type: "media-error";
  tvId: string;
  message: string;
  code: string;
};

export type MediaControlEvent = PlaybackEvent;

export type MediaControlMessage = {
  type: "media-control";
  tvId: string;
  event: MediaControlEvent;
  volume?: number;
  repeat?: boolean;
  shuffle?: boolean;
  playlistId?: string;
  playlistName?: string;
  playbackState?: "playing" | "paused" | "stopped";
  contentId?: string;
  currentMedia?: { id: string; name: string; kind: "IMAGE" | "VIDEO" };
  contentType?: "IMAGE" | "VIDEO";
};

export type CommandResultMessage = PlaybackResult & { type: "command-result" };
export type CommandErrorMessage = { type: "command-error"; requestId?: string; code: string; message: string };
export type MediaProgressMessage = { type: "media-progress"; requestId: string; tvId: string; action: PlaybackEvent; percent: number };
export type AdminMessage = MediaProgressMessage | DevicesStatusMessage | PendingDevicesMessage | MediaReadyMessage | MediaListErrorMessage | MediaControlMessage | CommandResultMessage | CommandErrorMessage;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function parsePayload(payload: unknown): unknown {
  if (typeof payload !== "string") return payload;
  try {
    return JSON.parse(payload) as unknown;
  } catch {
    return null;
  }
}

function getDeviceIds(value: unknown): string[] | null {
  if (!Array.isArray(value)) return null;
  const devices = value.filter(
    (item): item is DeviceReference => isRecord(item) && typeof item.tv_id === "string",
  );
  return devices.length === value.length ? [...new Set(devices.map((item) => item.tv_id))] : null;
}

function getPendingDevices(value: unknown): ConnectedTvDto[] | null {
  if (!Array.isArray(value)) return null;
  const devices = value.filter(
    (item): item is ConnectedTvDto => isRecord(item)
      && typeof item.tvId === "string"
      && typeof item.ip === "string"
      && typeof item.model === "string"
      && typeof item.version_android === "string",
  );
  return devices.length === value.length ? devices : null;
}

export function parseAdminMessage(payload: unknown): AdminMessage | null {
  const message = parsePayload(payload);
  if (!isRecord(message) || typeof message.evento !== "string") return null;
  const data = isRecord(message.datos) ? message.datos : message;

  if (message.evento === "media.progress") {
    if (typeof data.request_id !== "string" || typeof data.tv_id !== "string" || !PLAYBACK_EVENTS.includes(data.accion as PlaybackEvent) || typeof data.porcentaje !== "number" || !Number.isFinite(data.porcentaje) || data.porcentaje < 0 || data.porcentaje > 100) return null;
    return { type: "media-progress", requestId: data.request_id, tvId: data.tv_id, action: data.accion as PlaybackEvent, percent: data.porcentaje };
  }
  if (message.evento === "media.result") {
    if (typeof data.request_id !== "string" || !data.request_id || typeof data.tv_id !== "string" || !data.tv_id.trim() || typeof data.ok !== "boolean" || !PLAYBACK_EVENTS.includes(data.accion as PlaybackEvent)) return null;
    return { type: "command-result", requestId: data.request_id, tvId: data.tv_id, action: data.accion as PlaybackEvent, ok: data.ok, ...(typeof data.code === "string" ? { code: data.code } : {}), ...(typeof data.message === "string" ? { message: data.message } : {}) };
  }
  if (message.evento === "media.error") {
    if (typeof data.message !== "string") return null;
    if (typeof data.tv_id === "string" && !data.request_id) return { type: "media-error", tvId: data.tv_id, code: typeof data.code === "string" ? data.code : "PLAYBACK_FAILED", message: data.message };
    return { type: "command-error", requestId: typeof data.request_id === "string" ? data.request_id : undefined, code: typeof data.code === "string" ? data.code : "INVALID_COMMAND", message: data.message };
  }

  if (message.evento === "devices.status") {
    const online = getDeviceIds(data.enline ?? data.enlinea);
    const lowSignal = getDeviceIds(data.low_sengal ?? data.low_signal);
    if (!online || !lowSignal) return null;
    return {
      type: "status",
      onlineTvIds: [...new Set([...online, ...lowSignal])],
      lowSignalTvIds: lowSignal,
    };
  }

  if (message.evento === "devices.pending") {
    const devices = getPendingDevices(data.pendientes_registro);
    return devices ? { type: "pending", devices } : null;
  }

  if (message.evento === "media.lista") {
    const tvId = data.tv_id;
    const status = data.estado;
    const content = isRecord(data.contenido)
      ? data.contenido
      : typeof data.url === "string"
        ? { url: data.url }
        : null;
    if (typeof tvId !== "string" || !tvId.trim() || !content) return null;
    if (status !== undefined && status !== "LISTO_PARA_REPRODUCIR") return null;
    return { type: "media-ready", tvId, content, status: "LISTO_PARA_REPRODUCIR" };
  }

  if (message.evento === "media.lista.error") {
    const tvId = data.tv_id;
    const errorMessage = data.message;
    const code = data.code ?? "MEDIA_ERROR";
    if (typeof tvId !== "string" || !tvId.trim() || typeof errorMessage !== "string" || typeof code !== "string") return null;
    return { type: "media-error", tvId, message: errorMessage, code };
  }

  if (["media.play", "media.pause", "media.stop", "media.volume", "media.repeat", "media.show", "media.hide", "media.shuffle"].includes(message.evento)) {
    const tvId = data.tv_id;
    if (typeof tvId !== "string" || !tvId.trim()) return null;
    const event = message.evento as MediaControlEvent;
    const current = isRecord(data.contenido_actual) ? data.contenido_actual : null;
    const source = {
      ...(["PLAYING", "PAUSED", "STOPPED"].includes(String(data.estado_reproduccion)) ? { playbackState: String(data.estado_reproduccion).toLowerCase() as "playing" | "paused" | "stopped" } : {}),
      ...(typeof data.playlist_nombre === "string" ? { playlistName: data.playlist_nombre } : {}),
      ...(current && typeof current.id === "string" && typeof current.nombre === "string" ? { currentMedia: { id: current.id, name: current.nombre, kind: (current.tipo === "VIDEO" ? "VIDEO" : "IMAGE") as "VIDEO" | "IMAGE" } } : {}),
      ...(typeof data.volumen === "number" && Number.isInteger(data.volumen) && data.volumen >= 0 && data.volumen <= 100 ? { volume: data.volumen } : {}),
      ...(typeof data.repetir === "boolean" ? { repeat: data.repetir } : {}),
      ...(typeof data.aleatorio === "boolean" ? { shuffle: data.aleatorio } : {}),
      ...(typeof data.playlist_id === "string" ? { playlistId: data.playlist_id } : {}),
      ...(typeof data.contenido_id === "string" ? { contentId: data.contenido_id } : {}),
      ...(["IMAGE", "IMAGEN", "VIDEO"].includes(String(data.tipo)) ? { contentType: (data.tipo === "VIDEO" ? "VIDEO" : "IMAGE") as "IMAGE" | "VIDEO" } : {}),
    };
    if (data.playlist_id !== undefined && typeof data.playlist_id !== "string") return null;
    if (data.contenido_id !== undefined && typeof data.contenido_id !== "string") return null;
    if (data.playlist_id && data.contenido_id) return null;

    if (event === "media.volume") {
      const volume = data.volumen;
      if (typeof volume !== "number" || !Number.isInteger(volume) || volume < 0 || volume > 100) return null;
      return { type: "media-control", tvId, event, volume, ...source };
    }
    if (event === "media.repeat") {
      const repeat = data.repetir;
      if (typeof repeat !== "boolean") return null;
      return { type: "media-control", tvId, event, repeat, ...source };
    }
    if (event === "media.shuffle") {
      if (typeof data.aleatorio !== "boolean") return null;
      return { type: "media-control", tvId, event, shuffle: data.aleatorio, ...source };
    }
    return { type: "media-control", tvId, event, ...source };
  }

  return null;
}
