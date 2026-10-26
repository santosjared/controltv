export type TvPresence = "online" | "low-signal" | "offline" | "unknown";

export function tvPresence(tvId: string, connected: boolean, hasSnapshot: boolean, onlineIds: readonly string[], lowSignalIds: readonly string[]): TvPresence {
  if (!connected || !hasSnapshot) return "unknown";
  if (lowSignalIds.includes(tvId)) return "low-signal";
  return onlineIds.includes(tvId) ? "online" : "offline";
}
