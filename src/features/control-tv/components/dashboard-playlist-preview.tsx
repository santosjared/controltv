"use client";

import { useEffect, useRef } from "react";
import { Eye, FileVideo, ImageIcon, X } from "lucide-react";
import { useGetPlaylistQuery, playlistError } from "@/features/playlists/api/playlists-api";
import { useAuth } from "@/features/auth/auth-context";
import type { PreviewMedia } from "@/features/playlists/components/playlist-media-preview";

export function DashboardPlaylistPreview({ id, onClose, onPreview }: { id: string; onClose: () => void; onPreview: (item: PreviewMedia) => void }) {
  const { data, isFetching, error } = useGetPlaylistQuery(id, { refetchOnMountOrArgChange: true });
  const { can } = useAuth();
  const close = useRef<HTMLButtonElement>(null);
  const dialog = useRef<HTMLElement>(null);
  useEffect(() => {
    const focus = document.activeElement;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    close.current?.focus();
    return () => { document.body.style.overflow = overflow; if (focus instanceof HTMLElement && focus.isConnected) focus.focus(); };
  }, []);
  return <div className="fixed inset-0 z-80 grid place-items-center bg-black/65 p-4 backdrop-blur-sm" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }} onKeyDown={(event) => {
    if (event.key === "Escape") { event.stopPropagation(); onClose(); }
    if (event.key === "Tab") {
      const buttons = dialog.current?.querySelectorAll<HTMLButtonElement>("button:not(:disabled)");
      const first = buttons?.[0], last = buttons?.[buttons.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    }
  }}><section ref={dialog} role="dialog" aria-modal="true" aria-labelledby="playlist-contents-title" className="w-full max-w-xl overflow-hidden rounded-2xl bg-white shadow-2xl">
    <header className="flex items-center justify-between gap-3 border-b border-[#e8ecea] p-5"><span className="min-w-0"><h2 id="playlist-contents-title" className="break-words text-xl font-bold">{data?.name ?? "Contenido de la playlist"}</h2><p className="mt-1 text-sm text-[#708078]">Orden de reproducción</p></span><button ref={close} type="button" onClick={onClose} aria-label="Cerrar contenido de playlist" className="grid size-10 shrink-0 place-items-center rounded-full bg-[#f0f5f2]"><X size={20} /></button></header>
    <div className="max-h-[65vh] overflow-y-auto p-5" aria-busy={isFetching}>
      {isFetching ? <p role="status">Cargando playlist…</p> : error ? <p role="alert" className="text-[#b4232c]">{playlistError(error, "No se pudo cargar la playlist.")}</p> : <>
        {data?.description && <p className="mb-4 text-sm text-[#708078]">{data.description}</p>}
        {!data?.items.length && <p className="py-6 text-center text-[#708078]">Esta playlist no tiene contenido.</p>}
        <ol className="space-y-2">{data?.items.map((item, index) => <li key={item.id} className="flex items-center gap-3 rounded-xl border border-[#e0e7e3] p-3"><span className="text-sm text-[#708078]">{index + 1}</span><span className="grid size-10 shrink-0 place-items-center rounded-lg bg-[#e2f1ea] text-[#08783f]">{item.type === "VIDEO" ? <FileVideo size={21} /> : <ImageIcon size={21} />}</span><span className="min-w-0 flex-1"><strong className="block break-words text-sm">{item.name}</strong><small className="text-[#708078]">{item.type === "VIDEO" ? "Video" : "Imagen"} · {Math.floor(item.duration / 60).toString().padStart(2, "0")}:{(item.duration % 60).toString().padStart(2, "0")}</small></span><button type="button" disabled={!can("content.view")} onClick={() => onPreview({ id: item.contentId, name: item.name, kind: item.type, url: `/api/contenidos/${encodeURIComponent(item.contentId)}/archivo` })} aria-label={`Vista previa de ${item.name}`} title="Vista previa" className="grid size-9 shrink-0 place-items-center rounded-lg text-[#08783f] hover:bg-[#edf8f3] disabled:opacity-40"><Eye size={18} /></button></li>)}</ol>
      </>}
    </div>
  </section></div>;
}
