"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { io } from "socket.io-client";
import { useAuth } from "@/features/auth/auth-context";
import type { Television } from "../types";
import { mapConnectedTv } from "../api/tv-adapter";
import { parseAdminMessage, type MediaControlMessage } from "../api/admin-message-adapter";
import { buildPlaybackCommand, buildSocketCommand, type PlaybackAction, type PlaybackCommand, type PlaybackEvent, type PlaybackSelection } from "../api/playback-protocol";
import { registerRequest, settleResult, failPending, updateProgress, type PlaybackRequests } from "../api/playback-requests";

type DevicePresence = { onlineTvIds: string[]; lowSignalTvIds: string[] };
type DashboardSocket = {
  connected: boolean;
  emit: (event: string, payload: unknown) => void;
  on: (event: string, listener: (...args: never[]) => void) => void;
  off: (event: string, listener: (...args: never[]) => void) => void;
  connect: () => void;
  close: () => void;
};
export type MediaReadyState = { sequence: number; content: Record<string, unknown>; status: "LISTO_PARA_REPRODUCIR" };
export type MediaErrorState = { sequence: number; tvId: string; message: string; code: string };
export type AdminCommandEvent = PlaybackEvent;
type PlaybackSendResult = { sent: string[]; failed: string[]; requestId?: string; error: string | null };
export type MediaControlState = {
  sequence: number; event?: PlaybackEvent; status?: "playing" | "available"; playbackState?: "playing" | "paused" | "stopped";
  playlistName?: string;
  currentMedia?: MediaControlMessage["currentMedia"];
  volume?: number; repeat?: boolean; shuffle?: boolean; playlistId?: string; contentId?: string; contentType?: "IMAGE" | "VIDEO"; confirmed?: boolean;
};

export function useConnectedTvs() {
  const { user, can } = useAuth();
  const canControl = can("televisions.control");
  const allowed = canControl || can("televisions.view");
  const userId = user?.id;
  const [devices, setDevices] = useState<Television[] | null>(null);
  const [presence, setPresence] = useState<DevicePresence>({ onlineTvIds: [], lowSignalTvIds: [] });
  const [hasStatusSnapshot, setHasStatusSnapshot] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [commandError, setCommandError] = useState<string | null>(null);
  const [mediaReadyByTvId, setMediaReadyByTvId] = useState<Record<string, MediaReadyState>>({});
  const [mediaErrorByTvId, setMediaErrorByTvId] = useState<Record<string, MediaErrorState>>({});
  const [latestMediaError, setLatestMediaError] = useState<MediaErrorState | null>(null);
  const [mediaControlByTvId, setMediaControlByTvId] = useState<Record<string, MediaControlState>>({});
  const [requests, setRequests] = useState<PlaybackRequests>({});
  const requestsRef = useRef<PlaybackRequests>({});
  const socketRef = useRef<DashboardSocket | null>(null);
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const mediaErrorSequence = useRef(0);
  const publishRequests = useCallback((next: PlaybackRequests) => { requestsRef.current = next; setRequests(next); }, []);
  const applyState = useCallback((message: MediaControlMessage) => {
    setMediaControlByTvId((current) => {
      const previous = current[message.tvId];
      const active = message.event === "media.play" || message.event === "media.show";
      const stopped = message.event === "media.stop" || message.event === "media.hide";
      const paused = message.event === "media.pause";
      return { ...current, [message.tvId]: {
        ...previous, sequence: (previous?.sequence ?? 0) + 1, event: message.event, confirmed: true,
        status: active ? "playing" : stopped || paused ? "available" : previous?.status,
        playbackState: active ? "playing" : paused ? "paused" : stopped ? "stopped" : previous?.playbackState,
        ...(message.playbackState ? { playbackState: message.playbackState, status: message.playbackState === "playing" ? "playing" as const : "available" as const } : {}),
        ...(message.playlistName ? { playlistName: message.playlistName } : {}),
        ...(message.currentMedia ? { currentMedia: message.currentMedia } : {}),
        ...(message.volume !== undefined ? { volume: message.volume } : {}),
        ...(message.repeat !== undefined ? { repeat: message.repeat } : {}),
        ...(message.shuffle !== undefined ? { shuffle: message.shuffle } : {}),
        ...(message.playlistId !== undefined ? { playlistId: message.playlistId, contentId: undefined, contentType: undefined } : {}),
        ...(message.contentId !== undefined ? { contentId: message.contentId, playlistId: undefined } : {}),
        ...(message.contentType !== undefined ? { contentType: message.contentType } : {}),
      } };
    });
  }, []);
  const dispatch = useCallback((command: PlaybackCommand): PlaybackSendResult => {
    const socket = socketRef.current;
    if (!canControl || !socket?.connected) return { sent: [], failed: command.datos.tv_ids, error: !canControl ? "Necesitas el permiso tvs.control." : "El socket está desconectado." };
    const busyTvIds = command.datos.tv_ids.filter((tvId) =>
      Object.values(requestsRef.current).some(
        (request) => request.targets[tvId]?.status === "pending",
      ),
    );
    if (busyTvIds.length)
      return {
        sent: [],
        failed: command.datos.tv_ids,
        error: "Hay una orden en proceso. Espera a que los televisores terminen de descargar o respondan.",
      };
    publishRequests(registerRequest(requestsRef.current, command));
    setCommandError(null);
    const id = command.datos.request_id;
    timers.current.set(id, setTimeout(() => {
      publishRequests(failPending(requestsRef.current, "PLAYBACK_TIMEOUT", "No se recibió confirmación de la TV dentro del tiempo esperado.", id));
      timers.current.delete(id);
    }, command.evento === "media.play" || command.evento === "media.show" ? 920000 : 35000));
    try {
      socket.emit("admin.message", command);
      return { sent: command.datos.tv_ids, failed: [], requestId: id, error: null };
    } catch {
      clearTimeout(timers.current.get(id)); timers.current.delete(id);
      publishRequests(failPending(requestsRef.current, "SEND_FAILED", "No se pudo enviar la orden.", id));
      return { sent: [], failed: command.datos.tv_ids, requestId: id, error: "No se pudo enviar la orden." };
    }
  }, [canControl, publishRequests]);
  const sendAdminCommand = useCallback((event: PlaybackEvent, data: Record<string, unknown>): boolean => {
    try {
      const ids = Array.isArray(data.tv_ids) ? data.tv_ids as string[] : typeof data.tv_id === "string" ? [data.tv_id] : [];
      const result = dispatch(buildSocketCommand(event, ids, data, crypto.randomUUID()));
      if (result.error) setCommandError(result.error);
      return !result.error;
    } catch (error) { setCommandError(error instanceof Error ? error.message : "Comando inválido."); return false; }
  }, [dispatch]);
  const sendPlayback = useCallback((action: PlaybackAction, ids: string[], selection: PlaybackSelection | null, enabled?: boolean): PlaybackSendResult => {
    try { return dispatch(buildPlaybackCommand(action, ids, selection, crypto.randomUUID(), enabled)); }
    catch (error) { return { sent: [], failed: ids, error: error instanceof Error ? error.message : "Comando inválido." }; }
  }, [dispatch]);
  const requestDeviceStatus = useCallback(() => {
    if (socketRef.current?.connected) socketRef.current.emit("admin.message", { evento: "devices.status.request", datos: {} });
  }, []);

  useEffect(() => {
    const url = process.env.NEXT_PUBLIC_SOCKET_URL;
    let disposed = false;
    let refreshTimer: ReturnType<typeof setTimeout>;
    let token: string | null = null;
    let refreshing = false;
    const controller = new AbortController();
    const requestTimers = timers.current;
    queueMicrotask(() => {
      if (disposed) return;
      setIsConnected(false); setHasStatusSnapshot(false); setPresence({ onlineTvIds: [], lowSignalTvIds: [] });
      setMediaControlByTvId({}); setMediaReadyByTvId({}); setMediaErrorByTvId({}); setLatestMediaError(null); setDevices(null); setCommandError(null); publishRequests({});
      setConnectionError(!allowed ? "Necesitas el permiso tvs.control para conectar el socket." : !url ? "Falta configurar NEXT_PUBLIC_SOCKET_URL." : null);
    });
    const receive = (payload: unknown) => {
      if (disposed) return;
      const message = parseAdminMessage(payload);
      if (!message) return;
      if (message.type === "status") { setPresence({ onlineTvIds: message.onlineTvIds, lowSignalTvIds: message.lowSignalTvIds }); setHasStatusSnapshot(true); return; }
      if (message.type === "pending") { setDevices(message.devices.map(mapConnectedTv)); return; }
      if (message.type === "media-control") { applyState(message); return; }
      if (message.type === "media-progress") {
        const next = updateProgress(requestsRef.current, message);
        if (next === requestsRef.current) return;
        publishRequests(next);
        clearTimeout(requestTimers.get(message.requestId));
        requestTimers.set(message.requestId, setTimeout(() => {
          publishRequests(failPending(requestsRef.current, "PLAYBACK_TIMEOUT", "La TV dejó de informar avance o confirmación.", message.requestId));
          requestTimers.delete(message.requestId);
        }, 920000));
        return;
      }
      if (message.type === "media-ready") {
        setMediaReadyByTvId((current) => ({ ...current, [message.tvId]: { sequence: (current[message.tvId]?.sequence ?? 0) + 1, content: message.content, status: message.status } })); return;
      }
      if (message.type === "media-error") {
        const error = { sequence: ++mediaErrorSequence.current, tvId: message.tvId, code: message.code, message: message.message };
        setMediaErrorByTvId((current) => ({ ...current, [message.tvId]: error })); setLatestMediaError(error); return;
      }
      if (message.type === "command-error") {
        setCommandError(message.message);
        if (message.requestId) {
          publishRequests(failPending(requestsRef.current, message.code, message.message, message.requestId));
          clearTimeout(requestTimers.get(message.requestId)); requestTimers.delete(message.requestId);
        }
        return;
      }
      const before = requestsRef.current;
      const next = settleResult(before, message);
      if (next === before) return;
      publishRequests(next);
      const request = next[message.requestId];
      if (Object.values(request.targets).every((outcome) => outcome.status !== "pending")) {
        clearTimeout(requestTimers.get(message.requestId)); requestTimers.delete(message.requestId);
      }
    };
    const createSocket = (accessToken: string) => {
      const previousSocket = socketRef.current;
      socketRef.current = null;
      previousSocket?.close();
      const socket = io(url!, { transports: ["websocket", "polling"], autoConnect: false, auth: { token: accessToken } } as never) as unknown as DashboardSocket;
      socketRef.current = socket;
      socket.on("admin.message", receive);
      socket.on("connect", () => { if (disposed || socketRef.current !== socket) return; setIsConnected(true); setConnectionError(null); requestDeviceStatus(); });
      socket.on("connect_error", (error: { message?: string }) => { if (disposed || socketRef.current !== socket) return; setIsConnected(false); setHasStatusSnapshot(false); setConnectionError(error.message ?? "No se pudo conectar el socket."); });
      socket.on("disconnect", () => {
        if (disposed || socketRef.current !== socket) return;
        setIsConnected(false); setHasStatusSnapshot(false); setPresence({ onlineTvIds: [], lowSignalTvIds: [] });
        setMediaControlByTvId({}); publishRequests(failPending(requestsRef.current, "CONNECTION_LOST", "Se perdió la conexión antes de recibir el resultado."));
        requestTimers.forEach(clearTimeout); requestTimers.clear();
      });
      socket.connect();
    };
    const syncToken = async () => {
      if (disposed || refreshing || !allowed || !userId || !url) return;
      refreshing = true;
      let delay = 60000;
      try {
        const response = await fetch("/api/auth/socket-token", { method: "POST", cache: "no-store", signal: AbortSignal.any([controller.signal, AbortSignal.timeout(10000)]) });
        const payload = await response.json() as { token?: string; expiresAt?: number; message?: string };
        if (disposed) return;
        if (!response.ok || !payload.token) throw new Error(payload.message ?? "No se pudo autenticar el socket.");
        delay = Math.max(5000, Math.min(60000, (payload.expiresAt ?? Date.now() + 90000) - Date.now() - 30000));
        if (token !== payload.token || !socketRef.current) { token = payload.token; createSocket(token); }
        else if (!socketRef.current.connected) socketRef.current.connect();
      } catch (error) {
        if (disposed) return;
        socketRef.current?.close(); socketRef.current = null; token = null;
        setIsConnected(false); setHasStatusSnapshot(false); setConnectionError(error instanceof Error ? error.message : "No se pudo autenticar el socket.");
      } finally {
        refreshing = false;
        if (!disposed && allowed) { clearTimeout(refreshTimer); refreshTimer = setTimeout(() => void syncToken(), delay); }
      }
    };
    const onFocus = () => { void syncToken(); };
    void syncToken(); window.addEventListener("focus", onFocus);
    return () => {
      disposed = true; controller.abort(); clearTimeout(refreshTimer); window.removeEventListener("focus", onFocus);
      requestTimers.forEach(clearTimeout); requestTimers.clear();
      socketRef.current?.off("admin.message", receive); socketRef.current?.close(); socketRef.current = null;
    };
  }, [allowed, userId, applyState, publishRequests, requestDeviceStatus]);

  const pendingTvIds = [...new Set(Object.values(requests).flatMap((request) => Object.entries(request.targets).filter(([, outcome]) => outcome.status === "pending").map(([id]) => id)))];
  return {
    socketDevices: devices, onlineTvIds: presence.onlineTvIds, lowSignalTvIds: presence.lowSignalTvIds,
    hasStatusSnapshot: allowed && hasStatusSnapshot, isSocketConnected: allowed && isConnected, connectionError, commandError,
    mediaReadyByTvId, mediaErrorByTvId, latestMediaError, dismissMediaError: () => setLatestMediaError(null), mediaControlByTvId,
    sendAdminCommand, sendPlayback, requestDeviceStatus, requests, pendingTvIds,
  };
}
