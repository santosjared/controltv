"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";

export type PreviewMedia = { id: string; name: string; kind: "VIDEO" | "IMAGE"; url: string };

export function PlaylistMediaPreview({ item, onClose }: { item: PreviewMedia; onClose: () => void }) {
  const closeButton = useRef<HTMLButtonElement>(null);
  const container = useRef<HTMLElement>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const previousFocus = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeButton.current?.focus();
    return () => {
      document.body.style.overflow = previousOverflow;
      if (previousFocus instanceof HTMLElement && previousFocus.isConnected) previousFocus.focus();
    };
  }, []);

  return <div className="fixed inset-0 z-80 grid place-items-center bg-black/75 p-4 backdrop-blur-sm" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }} onKeyDown={(event) => {
    if (event.key === "Escape") { event.stopPropagation(); onClose(); }
    if (event.key === "Tab") {
      const elements = container.current?.querySelectorAll<HTMLElement>('button, video[controls], [tabindex="0"]');
      const first = elements?.[0];
      const last = elements?.[elements.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    }
  }}>
    <section ref={container} role="dialog" aria-modal="true" aria-labelledby="playlist-preview-title" className="w-full max-w-5xl overflow-hidden rounded-2xl bg-[#07110d] text-white shadow-2xl">
      <header className="flex items-center justify-between gap-4 border-b border-white/15 px-5 py-4"><span className="min-w-0"><h2 id="playlist-preview-title" className="truncate text-lg font-semibold">{item.name}</h2><p className="text-sm text-white/60">Vista previa · {item.kind === "VIDEO" ? "Video" : "Imagen"}</p></span><button ref={closeButton} type="button" onClick={onClose} aria-label="Cerrar vista previa" className="grid size-10 shrink-0 place-items-center rounded-full bg-white/10 hover:bg-white/20"><X size={20} /></button></header>
      <div className="relative grid min-h-60 place-items-center bg-black" aria-busy={loading && !failed}>
        {failed ? <p role="alert" className="p-8 text-center text-sm text-white/80">No se pudo cargar el archivo. Cierra la vista previa y vuelve a intentarlo.</p> : <>
          {item.kind === "IMAGE" ? <Image src={item.url} alt={item.name} width={1600} height={900} unoptimized onLoad={() => setLoading(false)} onError={() => { setFailed(true); setLoading(false); }} className="max-h-[72vh] w-auto max-w-full object-contain" /> : <video src={item.url} controls controlsList="nodownload" preload="metadata" onLoadedData={() => setLoading(false)} onError={() => { setFailed(true); setLoading(false); }} className="max-h-[72vh] w-full object-contain" />}
          {loading && <p role="status" className="pointer-events-none absolute inset-0 grid place-items-center text-sm text-white/70">Cargando vista previa…</p>}
        </>}
      </div>
    </section>
  </div>;
}
