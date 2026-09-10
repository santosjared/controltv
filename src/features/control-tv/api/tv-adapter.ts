import type { Television } from "../types";

export type ConnectedTvDto = {
  tvId: string;
  ip: string;
  model: string;
  version_android: string;
};

export type RegisteredTvDto = {
  id: string;
  tv_id: string;
  nombre: string | null;
  model: string;
  version_android: string;
  ip: string;
  ultimo_contacto: string;
  sala: {
    id: string;
    nombre: string;
    ubicacion: string;
  };
  estado: {
    tv_id: string;
    contenido_id: string | null;
    estado_reproduccion: string;
    posicion_segundos: number;
    volumen: number;
    repetir: boolean;
    contenido: {
      id: string;
      nombre: string;
      tipo: string;
      url: string;
      tamano_bytes: string;
    } | null;
  } | null;
};

export function isConnectedTvDto(value: unknown): value is ConnectedTvDto {
  if (!value || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  return ["tvId", "ip", "model", "version_android"].every((key) => typeof record[key] === "string");
}

export function mapConnectedTv(device: ConnectedTvDto): Television {
  return {
    id: device.tvId,
    room: device.model || "Televisor",
    name: `${device.tvId} · Android ${device.version_android}`,
    ip: device.ip,
    status: "available",
    currentContent: "Sin reproducción",
    volume: 30,
    model: device.model,
    androidVersion: device.version_android,
  };
}

export function mapConnectedTvs(payload: unknown): Television[] | null {
  if (!Array.isArray(payload) || !payload.every(isConnectedTvDto)) return null;
  return payload.map(mapConnectedTv);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object";
}

export function isRegisteredTvDto(value: unknown): value is RegisteredTvDto {
  if (!isRecord(value) || !isRecord(value.sala)) return false;

  const room = value.sala;
  const requiredStrings = ["id", "tv_id", "model", "version_android", "ip", "ultimo_contacto"];
  const hasStrings = requiredStrings.every((key) => typeof value[key] === "string");
  const hasRoom = ["id", "nombre", "ubicacion"].every((key) => typeof room[key] === "string");
  const hasName = value.nombre === null || typeof value.nombre === "string";

  if (!hasStrings || !hasRoom || !hasName) return false;
  if (value.estado === null) return true;
  if (!isRecord(value.estado)) return false;

  const state = value.estado;
  const hasPlaybackState = typeof state.estado_reproduccion === "string";
  const hasStateNumbers = ["posicion_segundos", "volumen"].every(
    (key) => typeof state[key] === "number" && Number.isFinite(state[key]),
  );
  const hasRepeat = typeof state.repetir === "boolean";
  const hasContent = state.contenido === null || (
    isRecord(state.contenido)
    && ["id", "nombre", "tipo", "url", "tamano_bytes"].every(
      (key) => typeof (state.contenido as Record<string, unknown>)[key] === "string",
    )
  );

  return hasPlaybackState && hasStateNumbers && hasRepeat && hasContent;
}

export function mapRegisteredTv(device: RegisteredTvDto): Television {
  const playbackState = device.estado?.estado_reproduccion.toUpperCase();
  const status = !device.estado ? "offline" : playbackState === "PLAYING" ? "playing" : "available";
  const content = device.estado?.contenido;

  return {
    id: device.id,
    tvCode: device.tv_id,
    room: device.sala.nombre,
    name: device.nombre?.trim() || device.tv_id,
    ip: device.ip,
    status,
    currentContent: content?.nombre || "Sin reproducción",
    volume: device.estado?.volumen ?? 0,
    model: device.model,
    androidVersion: device.version_android,
    location: device.sala.ubicacion,
    lastContactAt: device.ultimo_contacto,
    currentContentUrl: content?.url,
    contentType: content?.tipo,
    playbackPosition: device.estado?.posicion_segundos ?? 0,
    repeat: device.estado?.repetir ?? false,
  };
}

export function mapRegisteredTvs(payload: unknown): Television[] | null {
  if (!Array.isArray(payload) || !payload.every(isRegisteredTvDto)) return null;
  return payload.map(mapRegisteredTv);
}
