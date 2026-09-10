"use client";

import { useEffect, useState } from "react";
import { io } from "socket.io-client";
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

export function useConnectedTvs() {
  const [devices, setDevices] = useState<Television[] | null>(null);
  const [presence, setPresence] = useState<DevicePresence>({ onlineTvIds: [], lowSignalTvIds: [] });
  const [hasStatusSnapshot, setHasStatusSnapshot] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [mediaReadyByTvId, setMediaReadyByTvId] = useState<Record<string, MediaReadyState>>({});

  useEffect(() => {
    const url = process.env.NEXT_PUBLIC_SOCKET_URL;
    if (!url) return;

    const socket = io(url, { transports: ["websocket", "polling"] });
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

      setPresence({ onlineTvIds: message.onlineTvIds, lowSignalTvIds: message.lowSignalTvIds });
      setHasStatusSnapshot(true);
    };

    socket.on("connect", () => setIsConnected(true));
    socket.on("disconnect", () => {
      setIsConnected(false);
      setPresence({ onlineTvIds: [], lowSignalTvIds: [] });
      setHasStatusSnapshot(false);
    });
    socket.on("admin.message", receiveAdminMessage);

    return () => {
      socket.off("admin.message", receiveAdminMessage);
      socket.close();
    };
  }, []);

  return {
    socketDevices: devices,
    onlineTvIds: presence.onlineTvIds,
    lowSignalTvIds: presence.lowSignalTvIds,
    hasStatusSnapshot,
    mediaReadyByTvId,
    isSocketConnected: isConnected,
  };
}
