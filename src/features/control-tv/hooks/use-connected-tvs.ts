"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { io, type Socket } from "socket.io-client";
import type { Television } from "../types";
import { mapConnectedTv } from "../api/tv-adapter";
import { parseAdminMessage } from "../api/admin-message-adapter";

type DevicePresence = {
  onlineTvIds: string[];
  lowSignalTvIds: string[];
};

export type MediaReadyState = {
  sequence: number;
  content: Record<string, unknown>;
  status: "LISTO_PARA_REPRODUCIR";
};

export type MediaErrorState = {
  sequence: number;
  tvId: string;
  message: string;
  code: string;
};

export type AdminCommandEvent = "media.play" | "media.pause" | "media.stop" | "media.volume" | "media.show" | "media.hide" | "media.repeat";

export type MediaControlState = {
  sequence: number;
  status?: "playing" | "available";
  playbackState?: "playing" | "paused" | "stopped";
  volume?: number;
  repeat?: boolean;
};

export function useConnectedTvs() {
  const [devices, setDevices] = useState<Television[] | null>(null);
  const [presence, setPresence] = useState<DevicePresence>({ onlineTvIds: [], lowSignalTvIds: [] });
  const [hasStatusSnapshot, setHasStatusSnapshot] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [mediaReadyByTvId, setMediaReadyByTvId] = useState<Record<string, MediaReadyState>>({});
  const [mediaErrorByTvId, setMediaErrorByTvId] = useState<Record<string, MediaErrorState>>({});
  const [latestMediaError, setLatestMediaError] = useState<MediaErrorState | null>(null);
  const [mediaControlByTvId, setMediaControlByTvId] = useState<Record<string, MediaControlState>>({});
  const socketRef = useRef<Socket | null>(null);
  const mediaErrorSequenceRef = useRef(0);

  const sendAdminCommand = useCallback((evento: AdminCommandEvent, datos: Record<string, unknown>): boolean => {
    const socket = socketRef.current;
    if (!socket?.connected) return false;
    socket.emit("admin.message", { evento, datos });
    return true;
  }, []);

  useEffect(() => {
    const url = process.env.NEXT_PUBLIC_SOCKET_URL;
    if (!url) return;

    const socket = io(url, { transports: ["websocket", "polling"] });
    socketRef.current = socket;
    const receiveAdminMessage = (payload: unknown) => {
      const message = parseAdminMessage(payload);
      if (!message) return;

      if (message.type === "pending") {
        setDevices(message.devices.map(mapConnectedTv));
        return;
      }

      if (message.type === "media-ready") {
        setMediaReadyByTvId((current) => ({
          ...current,
          [message.tvId]: {
            sequence: (current[message.tvId]?.sequence ?? 0) + 1,
            content: message.content,
            status: message.status,
          },
        }));
        return;
      }

      if (message.type === "media-error") {
        const error = {
          sequence: ++mediaErrorSequenceRef.current,
          tvId: message.tvId,
          message: message.message,
          code: message.code,
        };
        setMediaErrorByTvId((current) => ({ ...current, [message.tvId]: error }));
        setLatestMediaError(error);
        return;
      }

      if (message.type === "media-control") {
        setMediaControlByTvId((current) => {
          const previous = current[message.tvId];
          const status = message.event === "media.play" || message.event === "media.show"
            ? "playing"
            : message.event === "media.pause" || message.event === "media.stop" || message.event === "media.hide"
              ? "available"
              : previous?.status;
          const playbackState = message.event === "media.play" || message.event === "media.show"
            ? "playing"
            : message.event === "media.pause"
              ? "paused"
              : message.event === "media.stop" || message.event === "media.hide"
                ? "stopped"
                : previous?.playbackState;
          return {
            ...current,
            [message.tvId]: {
              ...previous,
              sequence: (previous?.sequence ?? 0) + 1,
              status,
              playbackState,
              ...(message.volume !== undefined ? { volume: message.volume } : {}),
              ...(message.repeat !== undefined ? { repeat: message.repeat } : {}),
            },
          };
        });
        return;
      }

      setPresence({ onlineTvIds: message.onlineTvIds, lowSignalTvIds: message.lowSignalTvIds });
      setHasStatusSnapshot(true);
    };

    socket.on("connect", () => setIsConnected(true));
    socket.on("disconnect", () => {
      setIsConnected(false);
      setPresence({ onlineTvIds: [], lowSignalTvIds: [] });
      setHasStatusSnapshot(false);
      setMediaControlByTvId({});
    });
    socket.on("admin.message", receiveAdminMessage);

    return () => {
      socket.off("admin.message", receiveAdminMessage);
      socket.close();
      socketRef.current = null;
    };
  }, []);

  return {
    socketDevices: devices,
    onlineTvIds: presence.onlineTvIds,
    lowSignalTvIds: presence.lowSignalTvIds,
    hasStatusSnapshot,
    mediaReadyByTvId,
    mediaErrorByTvId,
    latestMediaError,
    dismissMediaError: () => setLatestMediaError(null),
    mediaControlByTvId,
    sendAdminCommand,
    isSocketConnected: isConnected,
  };
}
