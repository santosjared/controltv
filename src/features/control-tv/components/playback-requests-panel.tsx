"use client";

import type { PlaybackRequests } from "../api/playback-requests";
import type { PlaybackEvent } from "../api/playback-protocol";

const actionLabels: Record<PlaybackEvent, string> = {
  "media.play": "Iniciar reproducción", "media.pause": "Pausar", "media.stop": "Detener",
  "media.show": "Mostrar imagen", "media.hide": "Ocultar imagen", "media.repeat": "Repetición",
  "media.shuffle": "Orden aleatorio", "media.volume": "Cambiar volumen",
};

export function PlaybackRequestsPanel({ requests }: { requests: PlaybackRequests }) {
  const relevant = Object.values(requests).filter((request) => Boolean(request.command.datos.contenido_id || request.command.datos.playlist_id) || Object.values(request.targets).some((outcome) => outcome.status === "error"));
  const active = relevant.filter((request) => Object.values(request.targets).some((outcome) => outcome.status === "pending"));
  const completed = relevant.filter((request) => Object.values(request.targets).every((outcome) => outcome.status !== "pending")).slice(-3);
  const displayed = [...active, ...completed].sort((a, b) => b.createdAt - a.createdAt);
  if (!displayed.length) return null;
  return <section aria-label="Resultados de órdenes" className="space-y-3 rounded-2xl border border-[#dfe5e2] bg-white p-4">
    <h2 className="font-semibold">Estado de las órdenes</h2>
    {displayed.map((request) => {
      const isContentDelivery = Boolean(request.command.datos.contenido_id || request.command.datos.playlist_id);
      const results = Object.entries(request.targets).filter(([, result]) => isContentDelivery || result.status === "error");
      const pending = results.filter(([, result]) => result.status === "pending").length;
      const successes = results.filter(([, result]) => result.status === "success").length;
      const errors = results.length - pending - successes;
      return <details open={errors > 0} key={request.command.datos.request_id} className="rounded-xl border border-[#e3e9e5] p-3">
        <summary className="cursor-pointer text-sm"><strong>{isContentDelivery ? "Envío de contenido" : actionLabels[request.command.evento]}</strong>{pending > 0 && ` · ${pending} pendientes`}{successes > 0 && ` · ${successes} completadas`}{errors > 0 && ` · ${errors} errores`}</summary>
        <p className="mt-2 break-all text-xs text-[#718079]">Referencia: {request.command.datos.request_id}</p>
        <ul className="mt-2 space-y-2">{results.map(([id, result]) => <li key={id} className="flex flex-wrap justify-between gap-2 text-sm"><strong>{id}</strong><span title={result.code} className={result.status === "error" ? "text-[#b4232c]" : result.status === "pending" ? "text-[#146be8]" : "text-[#08783f]"}>{result.status === "pending" ? (result.progress !== undefined ? `Descargando: ${result.progress}%` : "Pendiente") : result.status === "success" ? "Envío completado y confirmado por la TV" : result.message}</span></li>)}</ul>
      </details>;
    })}
  </section>;
}
