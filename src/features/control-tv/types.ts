export type TelevisionStatus = "playing" | "available" | "offline";

export type Television = {
  id: string;
  room: string;
  name: string;
  ip: string;
  signal: number;
  status: TelevisionStatus;
  currentContent: string;
  volume: number;
};
