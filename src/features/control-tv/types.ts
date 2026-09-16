export type TelevisionStatus = "playing" | "available" | "offline";
export type TelevisionConnectionStatus = "online" | "low-signal" | "offline";
export type TelevisionPlaybackState = "playing" | "paused" | "stopped";
export type TelevisionContentType = "IMAGE" | "VIDEO";

export type Television = {
  id: string;
  tvCode?: string;
  room: string;
  name: string;
  ip: string;
  signal?: number;
  status: TelevisionStatus;
  playbackState?: TelevisionPlaybackState;
  connectionStatus?: TelevisionConnectionStatus;
  currentContent: string;
  volume: number;
  model?: string;
  androidVersion?: string;
  location?: string;
  lastContactAt?: string;
  currentContentUrl?: string;
  currentContentId?: string;
  contentType?: TelevisionContentType;
  playbackPosition?: number;
  repeat?: boolean;
};
