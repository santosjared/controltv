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

export type AdminMessage = DevicesStatusMessage | PendingDevicesMessage | MediaReadyMessage;

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
  if (!isRecord(message) || typeof message.evento !== "string" || !isRecord(message.datos)) return null;

  if (message.evento === "devices.status") {
    const online = getDeviceIds(message.datos.enline ?? message.datos.enlinea);
    const lowSignal = getDeviceIds(message.datos.low_sengal ?? message.datos.low_signal);
    if (!online || !lowSignal) return null;
    return {
      type: "status",
      onlineTvIds: [...new Set([...online, ...lowSignal])],
      lowSignalTvIds: lowSignal,
    };
  }

  if (message.evento === "devices.pending") {
    const devices = getPendingDevices(message.datos.pendientes_registro);
    return devices ? { type: "pending", devices } : null;
  }

  if (message.evento === "media.lista") {
    const tvId = message.datos.tv_id;
    const content = message.datos.contenido;
    const status = message.datos.estado;
    if (typeof tvId !== "string" || !isRecord(content) || status !== "LISTO_PARA_REPRODUCIR") return null;
    return { type: "media-ready", tvId, content, status };
  }

  return null;
}
