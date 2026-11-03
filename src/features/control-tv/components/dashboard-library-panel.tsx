"use client";

import Image from "next/image";
import { useState } from "react";
import { Send, ChevronLeft, ChevronRight, Eye, FileVideo, ListVideo, LoaderCircle, Search } from "lucide-react";
import { useAuth } from "@/features/auth/auth-context";
import { mediaError, useGetMediaQuery } from "@/features/media-library/api/media-api";
import { useGetPlaylistsQuery } from "@/features/playlists/api/playlists-api";
import { PlaylistMediaPreview, type PreviewMedia } from "@/features/playlists/components/playlist-media-preview";
import { useDebouncedCallback } from "@/features/access-control/hooks/use-debounced-callback";

import { DashboardPlaylistPreview } from "./dashboard-playlist-preview";

import type { PlaybackSelection } from "../api/playback-protocol";

type LibraryTab = "playlists" | "videos" | "images";
const PAGE_SIZE = 4;

export function DashboardLibraryPanel({ selectedTvCount, socketConnected, sendPending, onSelectionChange, onSend }: { selectedTvCount: number; socketConnected: boolean; sendPending: boolean; onSelectionChange: (source: PlaybackSelection | null) => void; onSend: (source: PlaybackSelection) => boolean }) {
  const { can } = useAuth();
  const [activeTab, setActiveTab] = useState<LibraryTab>(can("playlists.view") ? "playlists" : "videos");
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [query, setQuery] = useState("");
  const [search, setSearch] = useState("");
  const [playlistPreviewId, setPlaylistPreviewId] = useState<string | null>(null);
  const [preview, setPreview] = useState<PreviewMedia | null>(null);
  const [sendingId, setSendingId] = useState<string | null>(null);
  const commitSearch = useDebouncedCallback((value: string) => { setSearch(value.trim()); setPage(1); setSelectedItemId(null); onSelectionChange(null); }, 350);
  const playlistsQuery = useGetPlaylistsQuery({ page, limit: PAGE_SIZE, search }, { skip: activeTab !== "playlists" || !can("playlists.view"), refetchOnFocus: true, refetchOnReconnect: true });
  const mediaQuery = useGetMediaQuery({ page, limit: PAGE_SIZE, search, type: activeTab === "videos" ? "VIDEO" : "IMAGEN" }, { skip: activeTab === "playlists" || !can("content.view"), refetchOnFocus: true, refetchOnReconnect: true });
  const playlists = playlistsQuery.currentData?.items ?? [];
  const total = activeTab === "playlists" ? playlistsQuery.currentData?.total ?? 0 : mediaQuery.currentData?.total ?? 0;
  const totalPages = activeTab === "playlists" ? playlistsQuery.currentData?.totalPages ?? 1 : mediaQuery.currentData?.totalPages ?? 1;
  const currentQuery = activeTab === "playlists" ? playlistsQuery : mediaQuery;
  const allowed = can(activeTab === "playlists" ? "playlists.view" : "content.view");
  if (!currentQuery.isFetching && page > totalPages) setPage(totalPages);
  const mediaItems = (mediaQuery.currentData?.items ?? []).filter((item) => item.kind === (activeTab === "videos" ? "VIDEO" : "IMAGE"));
  const rows = activeTab === "playlists" ? playlists : mediaItems;
  const selectedId = rows.some((item) => item.id === selectedItemId) ? selectedItemId : undefined;
  const canSend = selectedTvCount > 0 && socketConnected && can("televisions.control") && !currentQuery.error && !currentQuery.isFetching && !sendPending;
  const sendSource = (source: PlaybackSelection) => {
    if (!canSend) return;
    setSelectedItemId(source.id);
    onSelectionChange(source);
    if (onSend(source)) setSendingId(source.id);
  };
  const tabs: { id: LibraryTab; label: string }[] = [{ id: "playlists", label: "Playlists" }, { id: "videos", label: "Videos" }, { id: "images", label: "Imágenes" }];

  return <>
    <aside id="lista-reproduccion" className="sticky top-25 overflow-hidden rounded-2xl border border-[#dfe7e3] bg-white shadow-[0_10px_30px_rgba(25,45,38,.06)]">
      <div className="flex items-center justify-between border-b border-[#e8ecea] px-5 py-4"><span><h2 className="text-xl font-bold">Lista de reproducción</h2><small className="mt-0.5 block text-[#708078]">Selecciona el contenido para transmitir</small></span><small className="rounded-full bg-[#edf7f2] px-2.5 py-1 font-semibold text-[#08783f]">{total}</small></div>
      <div role="tablist" aria-label="Tipo de contenido" className="grid grid-cols-3 gap-1.5 px-4 pt-4">{tabs.map((tab) => <button key={tab.id} type="button" role="tab" aria-selected={activeTab === tab.id} disabled={!can(tab.id === "playlists" ? "playlists.view" : "content.view")} onClick={() => { setActiveTab(tab.id); setPage(1); setSelectedItemId(null); onSelectionChange(null); }} className={"rounded-xl px-2 py-2.5 text-sm font-semibold transition disabled:opacity-40 " + (activeTab === tab.id ? "bg-[#075f45] text-white shadow-sm" : "text-[#65766e] hover:bg-[#f0f5f2]")}>{tab.label}</button>)}</div>
      <label className="mx-4 mt-3 flex h-10 items-center gap-2 rounded-xl border border-[#d8dfdc] px-3"><Search size={16} className="text-[#718079]" /><input value={query} onChange={(event) => { setQuery(event.target.value); commitSearch(event.target.value); }} placeholder="Buscar contenido…" aria-label="Buscar en la lista de reproducción" className="min-w-0 flex-1 bg-transparent text-sm outline-none" /></label>
      <ol className="max-h-102 min-h-62 overflow-y-auto p-4" aria-busy={currentQuery.isFetching}>
        {!allowed && <li className="py-10 text-center text-sm text-[#7b8781]">No tienes permiso para ver este contenido.</li>}
        {allowed && currentQuery.isFetching && <li role="status" className="py-4 text-center text-sm text-[#7b8781]">Cargando contenido…</li>}
        {currentQuery.error && <li role="alert" className="rounded-xl bg-[#fff0f0] p-4 text-sm text-[#b4232c]">{mediaError(currentQuery.error, "No se pudo cargar el contenido.")}</li>}
        {!currentQuery.error && (activeTab === "playlists" ? playlists.map((playlist, index) => <li key={playlist.id} className="mb-2 flex items-center gap-1"><button type="button" aria-pressed={playlist.id === selectedId} onClick={() => { setSelectedItemId(playlist.id); onSelectionChange({ id: playlist.id, name: playlist.name, kind: "PLAYLIST" }); }} className={"flex min-w-0 flex-1 items-center gap-3 rounded-xl border p-2.5 text-left transition " + (playlist.id === selectedId ? "border-[#52ad86] bg-[#eef8f3]" : "border-transparent hover:bg-[#f6f8f7]")}><b className="w-4 text-center text-sm text-[#65766e]">{(page - 1) * PAGE_SIZE + index + 1}</b><span className="grid h-13 w-16 shrink-0 place-items-center rounded-lg bg-[#e2f1ea] text-[#08783f]"><ListVideo size={24} /></span><span className="min-w-0 flex-1"><strong className="block truncate text-sm">{playlist.name}</strong><small className="block truncate text-[#76827d]">{playlist.itemCount} elementos · {formatDuration(playlist.items.reduce((seconds, item) => seconds + item.duration, 0))}</small></span></button><button type="button" disabled={!canSend || playlist.itemCount === 0} onClick={() => sendSource({ id: playlist.id, name: playlist.name, kind: "PLAYLIST" })} aria-label={"Enviar " + playlist.name + " a " + selectedTvCount + " televisores seleccionados"} title={sendPending && sendingId === playlist.id ? "Enviando playlist…" : "Enviar playlist a los televisores seleccionados"} className="grid size-9 shrink-0 place-items-center rounded-lg text-[#08783f] hover:bg-[#edf8f3] disabled:cursor-not-allowed disabled:opacity-35">{sendPending && sendingId === playlist.id ? <LoaderCircle size={18} className="animate-spin" /> : <Send size={18} />}</button><button type="button" onClick={() => setPlaylistPreviewId(playlist.id)} aria-label={`Ver contenido de ${playlist.name}`} title="Ver contenido de la playlist" className="grid size-8 shrink-0 place-items-center rounded-lg text-[#08783f] hover:bg-[#edf8f3]"><Eye size={17} /></button></li>) : mediaItems.map((item, index) => <li key={item.id} className="mb-2 flex items-center gap-1"><button type="button" aria-pressed={item.id === selectedId} onClick={() => { setSelectedItemId(item.id); onSelectionChange({ id: item.id, name: item.name, kind: item.kind }); }} className={"flex min-w-0 flex-1 items-center gap-3 rounded-xl border p-2.5 text-left transition " + (item.id === selectedId ? "border-[#52ad86] bg-[#eef8f3]" : "border-transparent hover:bg-[#f6f8f7]")}><b className="w-4 text-center text-sm text-[#65766e]">{(page - 1) * PAGE_SIZE + index + 1}</b><span className="relative grid h-13 w-16 shrink-0 place-items-center overflow-hidden rounded-lg bg-[#dff1ea] text-[#08783f]">{item.kind === "IMAGE" ? <Image src={item.url} alt="" fill unoptimized className="object-cover" /> : <FileVideo size={24} />}</span><span className="min-w-0 flex-1"><strong className="block truncate text-sm">{item.name}</strong><small className="text-[#76827d]">{item.kind === "VIDEO" ? "Video" : "Imagen"}</small></span></button><button type="button" disabled={!canSend} onClick={() => sendSource({ id: item.id, name: item.name, kind: item.kind })} aria-label={"Enviar " + item.name + " a " + selectedTvCount + " televisores seleccionados"} title={sendPending && sendingId === item.id ? "Enviando contenido…" : "Enviar contenido a los televisores seleccionados"} className="grid size-9 shrink-0 place-items-center rounded-lg text-[#08783f] hover:bg-[#edf8f3] disabled:cursor-not-allowed disabled:opacity-35">{sendPending && sendingId === item.id ? <LoaderCircle size={18} className="animate-spin" /> : <Send size={18} />}</button><button type="button" onClick={() => setPreview(item)} aria-label={`Vista previa de ${item.name}`} title="Vista previa" className="grid size-8 shrink-0 place-items-center rounded-lg text-[#08783f] hover:bg-[#edf8f3]"><Eye size={17} /></button></li>))}
        {allowed && !currentQuery.isFetching && !currentQuery.error && rows.length === 0 && <li className="py-10 text-center text-sm text-[#7b8781]">No hay contenido disponible en esta categoría.</li>}
      </ol>
      {total > 0 && !currentQuery.error && <nav aria-label="Paginación de la biblioteca" className="flex items-center justify-between border-t border-[#e8ecea] px-4 py-3 text-sm"><button type="button" disabled={page <= 1 || currentQuery.isFetching} onClick={() => { setPage(page - 1); setSelectedItemId(null); onSelectionChange(null); }} aria-label="Página anterior" className="grid size-9 place-items-center rounded-lg border border-[#d8dfdc] disabled:opacity-40"><ChevronLeft size={17} /></button><span>{page} / {totalPages}</span><button type="button" disabled={page >= totalPages || currentQuery.isFetching} onClick={() => { setPage(page + 1); setSelectedItemId(null); onSelectionChange(null); }} aria-label="Página siguiente" className="grid size-9 place-items-center rounded-lg border border-[#d8dfdc] disabled:opacity-40"><ChevronRight size={17} /></button></nav>}
    </aside>
    {playlistPreviewId && <DashboardPlaylistPreview id={playlistPreviewId} onClose={() => setPlaylistPreviewId(null)} onPreview={(item) => { setPlaylistPreviewId(null); setPreview(item); }} />}
    {preview && <PlaylistMediaPreview key={preview.id} item={preview} onClose={() => setPreview(null)} />}
  </>;
}

function formatDuration(seconds: number) { return `${Math.floor(seconds / 60).toString().padStart(2, "0")}:${(seconds % 60).toString().padStart(2, "0")}`; }
