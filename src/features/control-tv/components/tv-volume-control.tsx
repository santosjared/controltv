"use client";

import { useEffect, useRef, useState } from "react";
import { Volume2, VolumeX } from "lucide-react";

export function TvVolumeControl({ volume, pending, disabled, onCommit }: { volume: number; pending: boolean; disabled: boolean; onCommit: (volume: number) => boolean }) {
  const [draft, setDraft] = useState<number | null>(null);
  const [showValue, setShowValue] = useState(false);
  const editing = useRef(false);
  const lastSent = useRef<number | null>(null);
  const beforeMute = useRef(volume || 50);
  const value = draft ?? volume;
  useEffect(() => {
    if (pending || editing.current || draft === null) return;
    let cancelled = false;
    queueMicrotask(() => { if (!cancelled) { setDraft(null); lastSent.current = null; } });
    return () => { cancelled = true; };
  }, [volume, pending, draft]);
  const commit = (next = value) => {
    editing.current = false;
    if (disabled || lastSent.current === next || (draft === null && next === volume)) return;
    lastSent.current = next;
    if (!onCommit(next)) { setDraft(null); lastSent.current = null; }
  };
  return <span className="relative ml-auto flex items-center gap-1.5" onClick={(event) => event.stopPropagation()} onPointerDown={(event) => event.stopPropagation()} onMouseEnter={() => setShowValue(true)} onMouseLeave={() => setShowValue(false)}>
    <span className="sr-only">Volumen {value}%</span>
    <button type="button" disabled={disabled} onClick={(event) => { event.preventDefault(); event.stopPropagation(); const next = value > 0 ? 0 : beforeMute.current; if (value > 0) beforeMute.current = value; setDraft(next); commit(next); }} aria-label={value === 0 ? "Restaurar volumen" : "Silenciar TV"} className="grid size-5 shrink-0 cursor-pointer place-items-center border-0 bg-transparent p-0 text-white disabled:opacity-45">{value === 0 ? <VolumeX size={16} /> : <Volume2 size={16} />}</button>
    <span className="relative flex w-14 items-center">
      {showValue && <output className="absolute -top-8 grid min-w-8 -translate-x-1/2 place-items-center rounded-md bg-white px-1.5 py-1 text-[10px] font-bold text-[#202226] shadow-md" style={{ left: `${value}%` }}>{value}</output>}
      <input type="range" min={0} max={100} step={1} value={value} aria-label={`Volumen ${value}%`} disabled={disabled} onFocus={() => setShowValue(true)} onPointerDown={() => { editing.current = true; setShowValue(true); }} onPointerUp={() => commit()} onPointerCancel={() => { editing.current = false; setDraft(null); }} onKeyDown={() => { editing.current = true; }} onKeyUp={() => commit()} onBlur={() => { commit(); setShowValue(false); }} onChange={(event) => { editing.current = true; setDraft(Number(event.target.value)); }} className="card-volume-range w-14 cursor-pointer disabled:opacity-45" style={{ background: `linear-gradient(to right, #1887f2 0 ${value}%, rgba(255,255,255,.42) ${value}% 100%)` }} />
    </span>
  </span>;
}
