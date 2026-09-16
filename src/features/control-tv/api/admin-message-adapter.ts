import type { ConnectedTvDto } from "./tv-adapter";

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

export type MediaControlEvent = "media.play" | "media.pause" | "media.stop" | "media.volume" | "media.repeat" | "media.show" | "media.hide";

export type MediaControlMessage = {
  type: "media-control";
  tvId: string;
  event: MediaControlEvent;
  volume?: number;
  repeat?: boolean;
};

export type AdminMessage = DevicesStatusMessage | PendingDevicesMessage | MediaReadyMessage | MediaListErrorMessage | MediaControlMessage;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object";
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
    if (typeof tvId !== "string" || !content) return null;
    if (status !== undefined && status !== "LISTO_PARA_REPRODUCIR") return null;
    return { type: "media-ready", tvId, content, status: "LISTO_PARA_REPRODUCIR" };
  }

  if (message.evento === "media.lista.error") {
    const tvId = data.tv_id;
    const errorMessage = data.message;
    const code = data.code;
    if (typeof tvId !== "string" || typeof errorMessage !== "string" || typeof code !== "string") return null;
    return { type: "media-error", tvId, message: errorMessage, code };
  }

  if (["media.play", "media.pause", "media.stop", "media.volume", "media.repeat", "media.show", "media.hide"].includes(message.evento)) {
    const tvId = data.tv_id;
    if (typeof tvId !== "string") return null;
    const event = message.evento as MediaControlEvent;

    if (event === "media.volume") {
      const volume = data.volumen;
      if (typeof volume !== "number" || !Number.isFinite(volume) || volume < 0 || volume > 100) return null;
      return { type: "media-control", tvId, event, volume };
    }
    if (event === "media.repeat") {
      const repeat = data.repetir;
      if (typeof repeat !== "boolean") return null;
      return { type: "media-control", tvId, event, repeat };
    }
    return { type: "media-control", tvId, event };
  }

  return null;
}
