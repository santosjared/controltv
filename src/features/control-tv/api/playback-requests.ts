import type { PlaybackCommand, PlaybackEvent } from "./playback-protocol";

export type CommandOutcome = { status: "pending" | "success" | "error"; code?: string; message?: string; progress?: number };
export type PlaybackRequest = { command: PlaybackCommand; createdAt: number; order: number; targets: Record<string, CommandOutcome> };
export type PlaybackRequests = Record<string, PlaybackRequest>;
export type PlaybackResult = { requestId: string; tvId: string; action: PlaybackEvent; ok: boolean; code?: string; message?: string };

export function registerRequest(requests: PlaybackRequests, command: PlaybackCommand): PlaybackRequests {
  const entries = Object.entries(requests);
  const retained = entries.filter(([, request]) => Object.values(request.targets).some((target) => target.status === "pending"));
  const completed = entries.filter(([, request]) => Object.values(request.targets).every((target) => target.status !== "pending")).slice(-49);
  const order = Math.max(0, ...entries.map(([, request]) => request.order)) + 1;
  return { ...Object.fromEntries([...completed, ...retained]), [command.datos.request_id]: { command, createdAt: Date.now(), order, targets: Object.fromEntries(command.datos.tv_ids.map((id) => [id, { status: "pending" as const }])) } };
}

export function settleResult(requests: PlaybackRequests, result: PlaybackResult): PlaybackRequests {
  const request = requests[result.requestId];
  if (!request || request.command.evento !== result.action || request.targets[result.tvId]?.status !== "pending") return requests;
  return { ...requests, [result.requestId]: { ...request, targets: { ...request.targets, [result.tvId]: result.ok ? { status: "success" } : { status: "error", code: result.code ?? "PLAYBACK_FAILED", message: result.message ?? "La TV no pudo ejecutar la orden." } } } };
}

export function failPending(requests: PlaybackRequests, code: string, message: string, requestId?: string): PlaybackRequests {
  return Object.fromEntries(Object.entries(requests).map(([id, request]) => [id, !requestId || requestId === id ? { ...request, targets: Object.fromEntries(Object.entries(request.targets).map(([tv, outcome]) => [tv, outcome.status === "pending" ? { status: "error" as const, code, message } : outcome])) } : request]));
}

export function updateProgress(requests: PlaybackRequests, result: { requestId: string; tvId: string; action: PlaybackEvent; percent: number }): PlaybackRequests {
  const request = requests[result.requestId];
  const target = request?.targets[result.tvId];
  if (!request || request.command.evento !== result.action || target?.status !== "pending" || result.percent <= (target.progress ?? -1)) return requests;
  return { ...requests, [result.requestId]: { ...request, targets: { ...request.targets, [result.tvId]: { ...target, progress: result.percent } } } };
}
