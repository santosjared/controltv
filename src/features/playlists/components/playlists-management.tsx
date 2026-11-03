"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { Check, ArrowDown, ArrowUp, ChevronLeft, ChevronRight, Clock3, Copy, FileVideo, GripVertical, Eye, ImageIcon, ListVideo, MoreVertical, Pencil, RefreshCw, Plus, Search, Shuffle, Trash2, X } from "lucide-react";
import { ManagementShell } from "@/features/access-control/components/management-shell";
import { useAuth } from "@/features/auth/auth-context";
import { playlistItemBody, playlistError, useGetPlaylistsQuery, useGetPlaylistQuery, useCreatePlaylistMutation, useUpdatePlaylistMutation, useDeletePlaylistMutation, useDuplicatePlaylistMutation, useReorderPlaylistMutation, useAddPlaylistItemMutation, useRemovePlaylistItemMutation, type PlaylistContent } from "../api/playlists-api";
import { useGetMediaQuery, type MediaItem } from "@/features/media-library/api/media-api";
import { useDebouncedCallback } from "@/features/access-control/hooks/use-debounced-callback";
import { movePlaylistItem, playlistOrderChanged } from "../order";
import { loadVideoDuration } from "../video-duration";
import { PlaylistMediaPreview, type PreviewMedia } from "./playlist-media-preview";

type ContentTiming = { duration: string; loading: boolean; error?: string };
const validDuration = (value: string) => Number.isInteger(Number(value)) && Number(value) >= 1 && Number(value) <= 3600;

function durationLabel(seconds: number) { const minutes = Math.floor(seconds / 60).toString().padStart(2, "0"); return `${minutes}:${(seconds % 60).toString().padStart(2, "0")}`; }
function totalDuration(items: PlaylistContent[]) { return items.reduce((total, item) => total + item.duration, 0); }

function paginationItems(current: number, total: number): Array<number | "ellipsis"> {
  if (total <= 7) return Array.from({ length: total }, (_, index) => index + 1);
  if (current <= 4) return [1, 2, 3, 4, 5, "ellipsis", total];
  if (current >= total - 3) return [1, "ellipsis", total - 4, total - 3, total - 2, total - 1, total];
  return [1, "ellipsis", current - 1, current, current + 1, "ellipsis", total];
}

export function PlaylistsManagement() {
  const { can } = useAuth();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState("");
  const [dialog, setDialog] = useState<"new" | "edit" | null>(null);
  const [preview, setPreview] = useState<PreviewMedia | null>(null);
  const [contentDialogOpen, setContentDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [contentQuery, setContentQuery] = useState("");
  const [contentPage, setContentPage] = useState(1);
  const [contentSelection, setContentSelection] = useState<string[]>([]);
  const [contentTimings, setContentTimings] = useState<Record<string, ContentTiming>>({});
  const validContentDuration = contentSelection.every((id) => contentTimings[id] && !contentTimings[id].loading && validDuration(contentTimings[id].duration));
  const durationRequests = useRef(new Map<string, AbortController>());
  useEffect(() => {
    const requests = durationRequests.current;
    return () => { requests.forEach((controller) => controller.abort()); requests.clear(); };
  }, [contentDialogOpen]);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [feedback, setFeedback] = useState<string | null>(null);
  const [operationError, setOperationError] = useState<string | null>(null);
  const [draft, setDraft] = useState<{ id: string; items: PlaylistContent[] } | null>(null);
  const [dragging, setDragging] = useState<{ playlistId: string; itemId: string } | null>(null);
  const [dropTarget, setDropTarget] = useState<string | null>(null);
  const { currentData: playlistsPage, isFetching, error: listError, refetch } = useGetPlaylistsQuery({ page, limit: 10, search });
  const playlists = playlistsPage?.items ?? [];
  const total = playlistsPage?.total ?? 0;
  const totalPages = playlistsPage?.totalPages ?? 1;
  if (playlistsPage && page > totalPages) setPage(totalPages);
  const activeId = playlists.some((playlist) => playlist.id === selectedId) ? selectedId : playlists[0]?.id ?? "";
  const { currentData: detail, isFetching: detailLoading, error: detailError, refetch: refetchDetail } = useGetPlaylistQuery(activeId, { skip: !activeId });
  const selected = detail;
  const orderedItems = draft?.id === activeId ? draft.items : selected?.items ?? [];
  const orderChanged = Boolean(selected && playlistOrderChanged(selected.items, orderedItems));
  const { currentData: contentResults, isFetching: contentLoading, error: contentError } = useGetMediaQuery({ page: contentPage, limit: 10, search: contentQuery }, { skip: !contentDialogOpen });
  const availableContent = (contentResults?.items ?? []).filter((item) => !selected?.items.some((current) => current.contentId === item.id));
  const [create, createState] = useCreatePlaylistMutation();
  const [update, updateState] = useUpdatePlaylistMutation();
  const [remove, deleteState] = useDeletePlaylistMutation();
  const [duplicate, duplicateState] = useDuplicatePlaylistMutation();
  const [reorder, reorderState] = useReorderPlaylistMutation();
  const [addItem, addState] = useAddPlaylistItemMutation();
  const [deleteItem, removeState] = useRemovePlaylistItemMutation();
  const [adding, setAdding] = useState(false);
  const busy = createState.isLoading || updateState.isLoading || deleteState.isLoading || duplicateState.isLoading || reorderState.isLoading || addState.isLoading || removeState.isLoading || adding || detailLoading;
  const commitSearch = useDebouncedCallback((value: string) => { setPage(1); setSelectedId(""); setDraft(null); setSearch(value.trim()); }, 350);
  const clearFeedback = () => { setOperationError(null); setFeedback(null); };
  const openNew = () => { clearFeedback(); setName(""); setDescription(""); setDialog("new"); };
  const openEdit = () => { if (!selected) return; clearFeedback(); setName(selected.name); setDescription(selected.description); setDialog("edit"); };
  const save = async (event: FormEvent) => {
    event.preventDefault(); if (busy || !name.trim()) return;
    setOperationError(null);
    try {
      const body = { nombre: name.trim(), descripcion: description.trim() };
      if (dialog === "new") { await create(body).unwrap(); setPage(1); setQuery(""); commitSearch(""); }
      else if (selected) await update({ id: selected.id, ...body }).unwrap();
      setFeedback(dialog === "new" ? "Playlist creada correctamente." : "Playlist actualizada correctamente."); setDialog(null);
    } catch (error) { setOperationError(playlistError(error, "No se pudo guardar la playlist.")); }
  };
  const removeItem = async (itemId: string) => {
    if (!selected || busy) return; clearFeedback();
    try { await deleteItem({ id: selected.id, itemId }).unwrap(); setDraft(null); setFeedback("Contenido quitado de la playlist."); }
    catch (error) { setOperationError(playlistError(error, "No se pudo quitar el contenido.")); }
  };
  const openContentDialog = () => { clearFeedback(); setContentQuery(""); setContentPage(1); setContentSelection([]); setContentTimings({}); setContentDialogOpen(true); };
  const toggleContent = async (item: MediaItem) => {
    if (busy) return;
    if (contentSelection.includes(item.id)) {
      durationRequests.current.get(item.id)?.abort(); durationRequests.current.delete(item.id);
      setContentSelection((current) => current.filter((id) => id !== item.id));
      setContentTimings((current) => ({ ...current, [item.id]: { ...current[item.id], loading: false } }));
      return;
    }
    setContentSelection((current) => [...current, item.id]);
    if (contentTimings[item.id]?.duration && !contentTimings[item.id]?.loading) return;
    if (item.kind === "IMAGE") {
      setContentTimings((current) => ({ ...current, [item.id]: { duration: "10", loading: false } }));
      return;
    }
    const controller = new AbortController(); durationRequests.current.set(item.id, controller);
    setContentTimings((current) => ({ ...current, [item.id]: { duration: "", loading: true } }));
    try {
      const duration = await loadVideoDuration(item.url, controller.signal);
      if (!controller.signal.aborted) setContentTimings((current) => ({ ...current, [item.id]: { duration: String(duration), loading: false } }));
    } catch (error) {
      if (!controller.signal.aborted) setContentTimings((current) => ({ ...current, [item.id]: { duration: "", loading: false, error: error instanceof Error ? error.message : "No se pudo leer la duración del video. Vuelve a seleccionarlo para reintentar." } }));
    } finally { if (durationRequests.current.get(item.id) === controller) durationRequests.current.delete(item.id); }
  };
  const addSelectedContent = async () => {
    if (!selected || !contentSelection.length || busy) return;
    setOperationError(null);
    if (!validContentDuration) { setOperationError("Cada elemento debe tener un tiempo entero entre 1 y 3600 segundos."); return; }
    setAdding(true);
    try {
      for (const id of contentSelection) {
        await addItem({ id: selected.id, body: playlistItemBody(id, Number(contentTimings[id].duration)) }).unwrap();
        setContentSelection((current) => current.filter((value) => value !== id));
        setDraft(null);
      }
      setDraft(null); setContentDialogOpen(false); setFeedback("Contenido agregado a la playlist.");
    } catch (error) { setOperationError(playlistError(error, "No se pudo agregar el contenido.")); }
    finally { setAdding(false); }
  };
  const deleteSelectedPlaylist = async () => {
    if (!selected || busy) return; setOperationError(null);
    try { await remove(selected.id).unwrap(); if (playlists.length === 1 && page > 1) setPage(page - 1); setSelectedId(""); setDraft(null); setDeleteDialogOpen(false); setFeedback("Playlist eliminada correctamente."); }
    catch (error) { setOperationError(playlistError(error, "No se pudo eliminar la playlist.")); }
  };
  const duplicateSelected = async () => {
    if (!selected || busy) return; clearFeedback();
    try { await duplicate(selected.id).unwrap(); setPage(1); setQuery(""); commitSearch(""); setFeedback("Playlist duplicada correctamente."); }
    catch (error) { setOperationError(playlistError(error, "No se pudo duplicar la playlist.")); }
  };
  const moveItem = (index: number, direction: number) => {
    if (!selected || busy || !can("playlists.manage")) return;
    const source = orderedItems[index];
    const target = orderedItems[index + direction];
    if (!source || !target) return;
    setDraft({ id: selected.id, items: movePlaylistItem(orderedItems, source.id, target.id) });
    clearFeedback();
  };
  const dropItem = (targetId: string) => {
    if (selected && !busy && can("playlists.manage") && dragging?.playlistId === selected.id) {
      setDraft({ id: selected.id, items: movePlaylistItem(orderedItems, dragging.itemId, targetId) });
      clearFeedback();
    }
    setDragging(null);
    setDropTarget(null);
  };
  const saveOrder = async () => {
    if (!selected || busy || !orderChanged || !can("playlists.manage")) return; clearFeedback();
    try { await reorder({ id: selected.id, item_ids: orderedItems.map((item) => item.id) }).unwrap(); setDraft(null); setFeedback("Orden guardado correctamente."); }
    catch (error) { setOperationError(playlistError(error, "No se pudo guardar el orden.")); }
  };

  return <ManagementShell active="playlists" title="Playlists" subtitle="Crea y organiza secuencias de contenido para reproducirlas en tus televisores.">
    <style>{`@media (max-width: 639px) { button[aria-label^="Quitar "] { opacity: 1 !important; } }`}</style>
    {feedback && <p role="status" className="mb-4 rounded-xl border border-[#b8dfcc] bg-[#eff9f4] p-4 text-sm text-[#076c3a]">{feedback}</p>}
    {operationError && !dialog && !contentDialogOpen && !deleteDialogOpen && <p role="alert" className="mb-4 rounded-xl bg-[#fff0f0] p-4 text-sm text-[#b4232c]">{operationError}</p>}
    <section className="mb-5 grid gap-4 rounded-2xl border border-[#dce5e1] bg-white p-5 shadow-[0_8px_25px_rgba(25,45,38,.05)] md:grid-cols-[minmax(240px,1fr)_auto_auto] md:items-center">
      <label className="flex h-12 items-center gap-3 rounded-xl border border-[#d5dfda] px-4 focus-within:border-[#08783f]"><Search size={20} className="text-[#64756e]" /><input value={query} onChange={(event) => { setQuery(event.target.value); commitSearch(event.target.value); }} placeholder="Buscar playlist..." className="min-w-0 flex-1 border-0 bg-transparent outline-none" /></label>
      <span className="flex h-12 items-center gap-3 rounded-xl bg-[#edf8f3] px-4 text-sm text-[#116a4b]"><ListVideo size={20} /><b>{total}</b> playlists</span>
      <div className="flex items-center gap-2"><button type="button" onClick={() => { void refetch(); if (activeId) void refetchDetail(); }} disabled={isFetching || busy} aria-label="Actualizar playlists" title="Actualizar playlists" className="grid size-12 shrink-0 place-items-center rounded-xl border border-[#d8dfdc] bg-white text-[#08783f] hover:bg-[#f0f8f4] disabled:opacity-50"><RefreshCw size={18} className={isFetching ? "animate-spin" : ""} /></button>{can("playlists.manage") ? <button type="button" onClick={openNew} disabled={busy} className="flex h-12 items-center justify-center gap-2 rounded-xl bg-[#08783f] px-5 font-semibold text-white hover:bg-[#066734]"><Plus size={20} />Nueva playlist</button> : <span className="flex h-12 items-center justify-center rounded-xl bg-[#eef2f0] px-5 text-sm font-semibold text-[#738079]">Solo lectura</span>}</div>
    </section>

    <div className="grid gap-5 xl:grid-cols-[360px_minmax(560px,1fr)]">
      <section className="order-2 space-y-3 xl:order-1" aria-busy={isFetching}>{isFetching && <p role="status" className="p-4 text-[#718079]">Cargando playlists…</p>}{listError && <p role="alert" className="rounded-xl bg-[#fff0f0] p-4 text-sm text-[#b4232c]">{playlistError(listError, "No se pudieron cargar las playlists.")}</p>}{playlists.map((playlist) => <article key={playlist.id} onClick={() => { if (!busy) { setSelectedId(playlist.id); setDraft(null); clearFeedback(); } }} className={`cursor-pointer rounded-2xl border p-4 transition ${playlist.id === activeId ? "border-[#159765] bg-[#edf8f3] shadow-[0_8px_22px_rgba(8,120,63,.08)]" : "border-[#dce4e0] bg-white hover:border-[#9fc9b5]"}`}><div className="flex items-start gap-3"><i className={`grid size-11 shrink-0 place-items-center rounded-xl not-italic ${playlist.id === activeId ? "bg-[#08783f] text-white" : "bg-[#e8f3ee] text-[#08783f]"}`}><ListVideo size={22} /></i><span className="min-w-0 flex-1"><strong className="block truncate text-lg">{playlist.name}</strong><small className="mt-1 line-clamp-2 text-[#6d7b75]">{playlist.description}</small></span><MoreVertical size={19} className="text-[#718079]" /></div><div className="mt-4 flex items-center justify-between border-t border-[#dfe7e3] pt-3 text-xs text-[#718079]"><span>{playlist.itemCount} elementos</span><span>{durationLabel(totalDuration(playlist.items))}</span><span>{playlist.updatedAt}</span></div></article>)}{!isFetching && !listError && playlists.length === 0 && <div className="rounded-2xl border border-dashed border-[#cfdad5] bg-white py-14 text-center text-[#718079]">No se encontraron playlists.</div>}
        {!listError && total > 0 && <footer className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#dce4e0] bg-white p-4"><p className="text-sm text-[#66736d]">Mostrando {(page - 1) * 10 + 1}–{Math.min(page * 10, total)} de {total}</p><nav aria-label="Paginación de playlists" className="flex max-w-full flex-wrap items-center overflow-hidden rounded-xl border border-[#d8dfdc]"><button type="button" disabled={page <= 1 || isFetching || busy} onClick={() => { setPage(page - 1); setDraft(null); }} aria-label="Página anterior" className="grid size-10 place-items-center disabled:opacity-40"><ChevronLeft size={18} /></button>{paginationItems(page, totalPages).map((item, index) => item === "ellipsis" ? <span key={"ellipsis-" + index} className="grid size-9 place-items-center text-[#718079]">…</span> : <button key={item} type="button" onClick={() => { setPage(item); setSelectedId(""); setDraft(null); }} disabled={isFetching || busy} aria-label={"Ir a la página " + item} aria-current={page === item ? "page" : undefined} className={"grid size-9 place-items-center border-l border-[#d8dfdc] text-sm font-semibold disabled:opacity-50 " + (page === item ? "bg-[#08783f] text-white" : "text-[#52625a] hover:bg-[#f0f8f4]")}>{item}</button>)}<button type="button" disabled={page >= totalPages || isFetching || busy} onClick={() => { setPage(page + 1); setDraft(null); }} aria-label="Página siguiente" className="grid size-10 place-items-center disabled:opacity-40"><ChevronRight size={18} /></button></nav></footer>}
      </section>
      {detailLoading && <p role="status" className="p-5 text-[#718079]">Cargando detalle…</p>}{detailError && <p role="alert" className="rounded-xl bg-[#fff0f0] p-5 text-[#b4232c]">{playlistError(detailError, "No se pudo cargar la playlist.")}</p>}

      {selected ? <section className="order-1 overflow-hidden rounded-2xl border border-[#dce4e0] bg-white shadow-[0_8px_25px_rgba(25,45,38,.05)] xl:order-2"><header className="flex flex-col gap-4 border-b border-[#e1e7e4] p-5 sm:flex-row sm:items-start sm:justify-between"><span><div className="flex items-center gap-2"><h2 className="text-2xl font-bold">{selected.name}</h2>{can("playlists.manage") && <button onClick={openEdit} disabled={busy} className="grid size-8 place-items-center rounded-lg text-[#146be8] hover:bg-[#edf4ff]" aria-label="Editar playlist"><Pencil size={17} /></button>}</div><p className="mt-1 text-[#697972]">{selected.description}</p><small className="mt-2 flex items-center gap-1.5 text-[#718079]"><Clock3 size={15} />{selected.items.length} elementos · {durationLabel(totalDuration(selected.items))}</small></span><div className="flex gap-2">{can("playlists.manage") && <><button type="button" onClick={() => void duplicateSelected()} disabled={busy} className="grid size-10 place-items-center rounded-xl border border-[#d9e2de] text-[#5f7169] hover:bg-[#f2f6f4]" aria-label="Duplicar playlist"><Copy size={18} /></button><button type="button" disabled={busy} onClick={() => { clearFeedback(); setDeleteDialogOpen(true); }} className="grid size-10 place-items-center rounded-xl border border-[#efc9cd] text-[#c43d47] transition hover:bg-[#fff0f1]" aria-label={`Eliminar playlist ${selected.name}`} title="Eliminar playlist"><Trash2 size={18} /></button></>}</div></header>
        <div className="p-5"><div className="mb-3 flex items-center justify-between"><h3 className="font-bold">Orden de reproducción</h3>{can("playlists.manage") && <button onClick={openContentDialog} disabled={busy} className="flex items-center gap-1.5 text-sm font-semibold text-[#08783f] disabled:opacity-40"><Plus size={17} />Agregar contenido</button>}</div><ol className="space-y-2">{orderedItems.map((item, index) => <li key={item.id}
          onDragOver={(event) => { if (!busy && can("playlists.manage") && dragging?.playlistId === activeId) { event.preventDefault(); event.dataTransfer.dropEffect = "move"; setDropTarget(item.id); } }}
          onDragLeave={(event) => { if (!(event.relatedTarget instanceof Node) || !event.currentTarget.contains(event.relatedTarget)) setDropTarget(null); }}
          onDrop={(event) => { event.preventDefault(); dropItem(item.id); }}
          className={"group flex items-center gap-3 rounded-xl border p-3 transition " + (dropTarget === item.id && dragging?.itemId !== item.id ? "border-[#159765] bg-[#edf8f3] ring-2 ring-[#159765]/20" : "border-[#e0e6e3] hover:border-[#a8cdbb] hover:bg-[#fafcfb]") + (dragging?.playlistId === activeId && dragging.itemId === item.id ? " opacity-50" : "")}>
          {can("playlists.manage") ? <button type="button" draggable={!busy && orderedItems.length > 1} disabled={busy || orderedItems.length < 2}
            onDragStart={(event) => { event.dataTransfer.effectAllowed = "move"; event.dataTransfer.setData("text/plain", item.id); setDragging({ playlistId: activeId, itemId: item.id }); }}
            onDragEnd={() => { setDragging(null); setDropTarget(null); }}
            onKeyDown={(event) => { if (event.key === "ArrowUp" || event.key === "ArrowDown") { event.preventDefault(); moveItem(index, event.key === "ArrowUp" ? -1 : 1); } }}
            aria-label={"Arrastrar para ordenar " + item.name} title="Arrastra para ordenar o usa las flechas del teclado" className="grid size-8 shrink-0 cursor-grab place-items-center rounded-lg text-[#718079] hover:bg-[#edf8f3] active:cursor-grabbing disabled:cursor-default disabled:opacity-40"><GripVertical size={19} /></button> : <GripVertical size={19} className="text-[#92a09a]" />}<b className="w-5 text-center text-sm text-[#65766e]">{index + 1}</b><i className={`grid h-14 w-22 shrink-0 place-items-center rounded-lg not-italic ${index % 2 ? "bg-[#dff1ea] text-[#08783f]" : "bg-[#123e32] text-white"}`}>{item.type === "VIDEO" ? <FileVideo size={25} /> : <ImageIcon size={25} />}</i><span className="min-w-0 flex-1"><button type="button" disabled={!item.contentId} onClick={() => setPreview({ id: item.contentId, name: item.name, kind: item.type, url: `/api/contenidos/${encodeURIComponent(item.contentId)}/archivo` })} className="block max-w-full truncate text-left font-bold hover:text-[#08783f] hover:underline" aria-label={`Ver vista previa de ${item.name}`}>{item.name}</button><small className="text-[#718079]">{item.type === "VIDEO" ? "Video" : "Imagen"} · {item.type === "IMAGE" ? "En pantalla: " : ""}{durationLabel(item.duration)}</small></span><button type="button" disabled={!item.contentId} onClick={() => setPreview({ id: item.contentId, name: item.name, kind: item.type, url: `/api/contenidos/${encodeURIComponent(item.contentId)}/archivo` })} aria-label={`Vista previa de ${item.name}`} title="Vista previa" className="grid size-9 shrink-0 place-items-center rounded-lg text-[#08783f] hover:bg-[#edf8f3] disabled:opacity-40"><Eye size={18} /></button>{can("playlists.manage") && <><button type="button" disabled={busy || index === 0} onClick={() => moveItem(index, -1)} aria-label={`Subir ${item.name}`} className="grid size-8 place-items-center text-[#08783f] disabled:opacity-30"><ArrowUp size={16} /></button><button type="button" disabled={busy || index === orderedItems.length - 1} onClick={() => moveItem(index, 1)} aria-label={`Bajar ${item.name}`} className="grid size-8 place-items-center text-[#08783f] disabled:opacity-30"><ArrowDown size={16} /></button><button type="button" disabled={busy} onClick={() => void removeItem(item.id)} className="grid size-9 place-items-center rounded-lg text-[#b3434b] opacity-0 hover:bg-[#fff0f1] group-hover:opacity-100" aria-label={`Quitar ${item.name}`}><Trash2 size={17} /></button></>}</li>)}{selected.items.length === 0 && <li className="rounded-xl border border-dashed border-[#cfdad5] py-12 text-center text-[#718079]">Esta playlist todavía no tiene contenido.</li>}</ol></div>
        <footer className="flex flex-col gap-3 border-t border-[#e1e7e4] bg-[#fafcfb] px-5 py-4 sm:flex-row sm:items-center sm:justify-between"><span className="flex items-center gap-2 text-sm text-[#617169]"><Shuffle size={18} className="text-[#08783f]" />Arrastra los elementos para cambiar el orden.</span>{can("playlists.manage") && <button type="button" onClick={() => void saveOrder()} disabled={busy || !orderChanged} className="flex h-10 items-center justify-center gap-2 rounded-xl border border-[#9bc8b3] bg-white px-4 font-semibold text-[#08783f] hover:bg-[#edf8f3] disabled:cursor-not-allowed disabled:border-[#d8dfdc] disabled:bg-[#f1f3f2] disabled:text-[#9aa59f] disabled:opacity-60"><Check size={18} />{reorderState.isLoading ? "Guardando…" : "Guardar orden"}</button>}</footer>
      </section> : null}
    </div>

    {dialog && <div className="fixed inset-0 z-60 grid place-items-center bg-black/55 p-4" onMouseDown={(event) => { if (!busy && event.target === event.currentTarget) setDialog(null); }}><form onSubmit={save} className="w-full max-w-lg overflow-hidden rounded-3xl bg-white shadow-2xl"><header className="flex items-start justify-between border-b border-[#e3e8e6] px-6 py-5"><span><h2 className="text-xl font-bold">{dialog === "new" ? "NUEVA PLAYLIST" : "EDITAR PLAYLIST"}</h2><p className="mt-1 text-sm text-[#75807b]">Configura la información principal de la lista.</p></span><button type="button" disabled={busy} onClick={() => setDialog(null)} className="grid size-9 place-items-center rounded-full bg-[#f1f3f2]"><X size={18} /></button></header><div className="space-y-4 p-6"><label className="block"><b className="mb-1.5 block text-sm">Nombre</b><input required value={name} onChange={(event) => setName(event.target.value)} className="h-12 w-full rounded-xl border border-[#d8dfdc] px-4 outline-none focus:border-[#08783f]" placeholder="Ej. Sala de espera" /></label><label className="block"><b className="mb-1.5 block text-sm">Descripción</b><textarea required value={description} onChange={(event) => setDescription(event.target.value)} rows={4} className="w-full rounded-xl border border-[#d8dfdc] px-4 py-3 outline-none focus:border-[#08783f]" placeholder="Describe el propósito de esta playlist" /></label>{operationError && <p role="alert" className="text-sm text-[#b4232c]">{operationError}</p>}</div><footer className="flex justify-end gap-3 border-t border-[#e3e8e6] px-6 py-4"><button type="button" disabled={busy} onClick={() => setDialog(null)} className="h-11 rounded-xl border border-[#d8dfdc] px-5">Cancelar</button><button disabled={busy || !name.trim()} className="flex h-11 items-center gap-2 rounded-xl bg-[#08783f] px-5 font-semibold text-white"><Check size={18} />{dialog === "new" ? "Crear playlist" : "Guardar cambios"}</button></footer></form></div>}
    {contentDialogOpen && <div className="fixed inset-0 z-60 grid place-items-center bg-black/55 p-4" onMouseDown={(event) => { if (!busy && event.target === event.currentTarget) setContentDialogOpen(false); }}><section role="dialog" aria-modal="true" aria-labelledby="content-dialog-title" className="flex max-h-[86vh] w-full max-w-2xl flex-col overflow-hidden rounded-3xl bg-white shadow-2xl"><header className="flex items-start justify-between border-b border-[#e3e8e6] px-6 py-5"><span><h2 id="content-dialog-title" className="text-xl font-bold">AGREGAR CONTENIDO</h2><p className="mt-1 text-sm text-[#75807b]">Selecciona uno o varios archivos para añadirlos a “{selected?.name}”.</p></span><button type="button" disabled={busy} onClick={() => setContentDialogOpen(false)} className="grid size-9 shrink-0 place-items-center rounded-full bg-[#f1f3f2] hover:bg-[#e8ecea]" aria-label="Cerrar"><X size={18} /></button></header><div className="border-b border-[#e7ebe9] p-5"><label className="flex h-11 items-center gap-3 rounded-xl border border-[#d5dfda] px-4 focus-within:border-[#08783f]"><Search size={19} className="text-[#6d7c75]" /><input value={contentQuery} onChange={(event) => { setContentQuery(event.target.value); setContentPage(1); }} placeholder="Buscar video o imagen..." className="min-w-0 flex-1 border-0 bg-transparent outline-none" /></label><p className="mt-3 text-xs text-[#718079]">Cada imagen se mostrará 10 segundos. Cada video usará su duración real.</p></div><div className="min-h-0 flex-1 overflow-y-auto p-5">{contentLoading && <p role="status" className="mb-3 text-sm text-[#718079]">Cargando contenido…</p>}{contentError && <p role="alert" className="mb-3 text-sm text-[#b4232c]">{playlistError(contentError, "No se pudo cargar el contenido.")}</p>}<div className="grid gap-3 sm:grid-cols-2">{availableContent.map((item) => {
          const checked = contentSelection.includes(item.id);
          const timing = contentTimings[item.id];
          return <div key={item.id} className={"rounded-2xl border p-3 transition " + (checked ? "border-[#159765] bg-[#edf8f3] ring-2 ring-[#159765]/10" : "border-[#dce4e0] hover:border-[#9fc9b5]")}>
            <button type="button" onClick={() => void toggleContent(item)} disabled={busy} aria-pressed={checked} className="flex w-full items-center gap-3 text-left">
              <span className={"grid size-14 shrink-0 place-items-center rounded-xl " + (item.kind === "VIDEO" ? "bg-[#123e32] text-white" : "bg-[#dff1ea] text-[#08783f]")}>{item.kind === "VIDEO" ? <FileVideo size={26} /> : <ImageIcon size={26} />}</span>
              <span className="min-w-0 flex-1"><strong className="block truncate text-sm">{item.name}</strong><small className="mt-1 block text-[#718079]">{item.kind === "VIDEO" ? "Video" : "Imagen"}</small></span>
              <span className={"grid size-5 shrink-0 place-items-center rounded-md border " + (checked ? "border-[#08783f] bg-[#08783f] text-white" : "border-[#aebbb5]" )}>{checked && <Check size={14} />}</span>
            </button>
            <button type="button" onClick={() => setPreview({ id: item.id, name: item.name, kind: item.kind, url: item.url })} className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg border border-[#c9ddd3] bg-white px-3 py-2 text-sm font-semibold text-[#08783f] hover:bg-[#f0f8f4]" aria-label={`Vista previa de ${item.name}`}><Eye size={16} />Vista previa</button>
            {checked && <div className="mt-3 border-t border-[#dce4e0] pt-3">
              {timing?.loading ? <p role="status" className="text-xs text-[#718079]">Leyendo duración del video…</p> : timing?.error ? <p role="alert" className="text-xs text-[#b4232c]">{timing.error}</p> : !validDuration(timing?.duration ?? "") ? <p role="alert" className="text-xs text-[#b4232c]">Este video supera el límite de 3600 segundos permitido por el servidor.</p> : <p className="flex items-center gap-1.5 text-xs font-semibold text-[#08783f]"><Clock3 size={14} />{item.kind === "IMAGE" ? "En pantalla: 10 segundos" : "Duración del video: " + durationLabel(Number(timing.duration))}</p>}
            </div>}
          </div>;
        })}</div>{availableContent.length === 0 && <div className="rounded-2xl border border-dashed border-[#ccd8d2] py-12 text-center text-[#718079]">No se encontraron archivos disponibles.</div>}</div>{operationError && <p role="alert" className="px-5 py-3 text-sm text-[#b4232c]">{operationError}</p>}<div className="flex items-center justify-between border-t border-[#e3e8e6] px-5 py-3 text-sm"><button type="button" disabled={contentPage <= 1 || contentLoading || busy} onClick={() => setContentPage(contentPage - 1)} className="rounded-lg border px-3 py-2 disabled:opacity-40">Anterior</button><span>{contentPage} / {contentResults?.totalPages ?? 1}</span><button type="button" disabled={contentPage >= (contentResults?.totalPages ?? 1) || contentLoading || busy} onClick={() => setContentPage(contentPage + 1)} className="rounded-lg border px-3 py-2 disabled:opacity-40">Siguiente</button></div><footer className="flex flex-col-reverse gap-3 border-t border-[#e3e8e6] px-6 py-4 sm:flex-row sm:items-center sm:justify-between"><span className="text-sm text-[#68776f]">{contentSelection.length} {contentSelection.length === 1 ? "archivo seleccionado" : "archivos seleccionados"}</span><div className="flex gap-3"><button type="button" disabled={busy} onClick={() => setContentDialogOpen(false)} className="h-11 rounded-xl border border-[#d8dfdc] px-5">Cancelar</button><button type="button" onClick={() => void addSelectedContent()} disabled={busy || contentLoading || contentSelection.length === 0 || !validContentDuration} className="flex h-11 items-center gap-2 rounded-xl bg-[#08783f] px-5 font-semibold text-white transition hover:bg-[#066734] disabled:cursor-not-allowed disabled:opacity-45"><Plus size={18} />Agregar seleccionados</button></div></footer></section></div>}
    {deleteDialogOpen && selected && <div className="fixed inset-0 z-60 grid place-items-center bg-black/55 p-4" onMouseDown={(event) => { if (!busy && event.target === event.currentTarget) setDeleteDialogOpen(false); }}><section role="alertdialog" aria-modal="true" aria-labelledby="delete-playlist-title" className="w-full max-w-md overflow-hidden rounded-3xl bg-white shadow-2xl"><header className="flex items-start justify-between border-b border-[#e8e4e4] px-6 py-5"><span><h2 id="delete-playlist-title" className="text-xl font-bold">ELIMINAR PLAYLIST</h2><p className="mt-1 text-sm text-[#7b8180]">Esta acción no se puede deshacer.</p></span><button type="button" disabled={busy} onClick={() => setDeleteDialogOpen(false)} className="grid size-9 place-items-center rounded-full bg-[#f1f3f2]" aria-label="Cerrar"><X size={18} /></button></header><div className="p-6"><div className="flex gap-4 rounded-2xl border border-[#f0cdd0] bg-[#fff4f5] p-4"><span className="grid size-11 shrink-0 place-items-center rounded-xl bg-[#f9dfe2] text-[#bf3944]"><Trash2 size={21} /></span><p className="text-sm leading-6 text-[#5f6864]">¿Estás seguro de eliminar <strong className="text-[#202925]">{selected.name}</strong>? También se quitará su orden de reproducción.</p></div>{operationError && <p role="alert" className="mt-4 text-sm text-[#b4232c]">{operationError}</p>}</div><footer className="flex justify-end gap-3 border-t border-[#e8e4e4] px-6 py-4"><button type="button" disabled={busy} onClick={() => setDeleteDialogOpen(false)} className="h-11 rounded-xl border border-[#d8dfdc] px-5">Cancelar</button><button type="button" disabled={busy} onClick={() => void deleteSelectedPlaylist()} className="flex h-11 items-center gap-2 rounded-xl bg-[#c83d47] px-5 font-semibold text-white transition hover:bg-[#ad303a]"><Trash2 size={18} />Eliminar</button></footer></section></div>}
    {preview && <PlaylistMediaPreview key={preview.id} item={preview} onClose={() => setPreview(null)} />}
  </ManagementShell>;
}
