export type TelevisionStatus = "playing" | "available" | "offline";
export type TelevisionConnectionStatus = "online" | "low-signal" | "offline";

export type Television = {
  id: string;
  tvCode?: string;
  room: string;
  name: string;
  ip: string;
  signal?: number;
  status: TelevisionStatus;
  connectionStatus?: TelevisionConnectionStatus;
  currentContent: string;
  volume: number;
  model?: string;
  androidVersion?: string;
  location?: string;
  lastContactAt?: string;
  currentContentUrl?: string;
  contentType?: string;
  playbackPosition?: number;
  repeat?: boolean;
};
