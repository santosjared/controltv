"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { ChevronLeft, ChevronRight, Pencil, FileVideo, Files, ImageIcon, RefreshCw, Save, Search, Trash2, Upload, X } from "lucide-react";
import { ManagementShell } from "@/features/access-control/components/management-shell";
import { useAuth } from "@/features/auth/auth-context";

import { mediaError, useGetMediaQuery, useLazyGetMediaItemQuery, useUploadMediaMutation, useUpdateMediaMutation, useDeleteMediaMutation, type MediaItem } from "../api/media-api";
import { useDebouncedCallback } from "@/features/access-control/hooks/use-debounced-callback";
const PAGE_SIZE = 4;

type PendingFile = { id: string; file: File; kind: "VIDEO" | "IMAGE"; url: string };

function formatSize(bytes: number) { return bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / 1024 / 1024).toFixed(bytes >= 10 * 1024 * 1024 ? 0 : 1)} MB`; }

export function MediaLibrary() {
  const { can } = useAuth();
  const [selectedId, setSelectedId] = useState("");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState<MediaItem | null>(null);
  const [editName, setEditName] = useState("");
  const [deleting, setDeleting] = useState<MediaItem | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [operationError, setOperationError] = useState<string | null>(null);
  const { currentData: mediaPage, isFetching, error: listError, refetch } = useGetMediaQuery({ page, limit: PAGE_SIZE, search });
  const [fetchDetail, detailState] = useLazyGetMediaItemQuery();
  const [upload, uploadState] = useUploadMediaMutation();
  const [update, updateState] = useUpdateMediaMutation();
  const [deleteItem, deleteState] = useDeleteMediaMutation();
  const commitSearch = useDebouncedCallback((value: string) => { setPage(1); setSearch(value.trim()); }, 350);
  const saving = uploadState.isLoading || updateState.isLoading || deleteState.isLoading;
  const [pendingFiles, setPendingFiles] = useState<PendingFile[]>([]);
  const [expandedPendingId, setExpandedPendingId] = useState<string | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const visibleItems = mediaPage?.items ?? [];
  const selected = detailState.currentData?.id === selectedId ? detailState.currentData : visibleItems.find((item) => item.id === selectedId) ?? visibleItems[0];
  const total = mediaPage?.total ?? 0;
  const totalPages = mediaPage?.totalPages ?? 1;
  const currentPage = page;
  if (mediaPage && page > mediaPage.totalPages) setPage(mediaPage.totalPages);
  const objectUrls = useRef(new Set<string>());
  useEffect(() => { const urls = objectUrls.current; return () => { urls.forEach((url) => URL.revokeObjectURL(url)); }; }, []);
  const stageFiles = (files: FileList | null) => {
    if (!files || saving) return;
    const available = 6 - pendingFiles.length;
    const valid = [...files].filter((file) => file.type.startsWith("video/") || file.type.startsWith("image/"));
    const oversized = valid.some((file) => file.size > 100 * 1024 * 1024);
    const accepted = valid.filter((file) => file.size <= 100 * 1024 * 1024).slice(0, Math.max(0, available));
    if (oversized) setFileError("Cada archivo debe pesar como máximo 100 MB.");
    else if (valid.length > available) setFileError("Puedes seleccionar un máximo de 6 archivos.");
    else if (valid.length !== files.length) setFileError("Solo se permiten imágenes y videos.");
    else setFileError(null);
    setPendingFiles((current) => [...current, ...accepted.map<PendingFile>((file) => ({ id: crypto.randomUUID(), file, kind: file.type.startsWith("image/") ? "IMAGE" : "VIDEO", url: (() => { const url = URL.createObjectURL(file); objectUrls.current.add(url); return url; })() }))]);
    if (inputRef.current) inputRef.current.value = "";
  };
  const discardPending = (id: string) => setPendingFiles((current) => { const target = current.find((item) => item.id === id); if (target) URL.revokeObjectURL(target.url); return current.filter((item) => item.id !== id); });
  const savePending = async () => {
    if (saving || !pendingFiles.length) return;
    setFileError(null);
    try {
      await upload(pendingFiles.map((pending) => pending.file)).unwrap();
      pendingFiles.forEach((pending) => { URL.revokeObjectURL(pending.url); objectUrls.current.delete(pending.url); });
      setPendingFiles([]); setExpandedPendingId(null); setPage(1); setQuery(""); commitSearch("");
      setSelectedId(""); setFeedback("Archivos registrados correctamente.");
    } catch (error) { setFileError(mediaError(error, "No se pudieron subir los archivos.")); }
  };
  const remove = async (item: MediaItem) => {
    setOperationError(null);
    try {
      await deleteItem(item.id).unwrap();
      if (visibleItems.length === 1 && page > 1) setPage(page - 1);
      setDeleting(null); if (selectedId === item.id) setSelectedId("");
      setFeedback("Contenido eliminado correctamente.");
    } catch (error) { setOperationError(mediaError(error, "No se pudo eliminar el contenido.")); }
  };
  const saveEdit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!editing || !editName.trim() || saving) return;
    setOperationError(null);
    try { await update({ id: editing.id, nombre: editName.trim() }).unwrap(); setEditing(null); setFeedback("Contenido actualizado correctamente."); }
    catch (error) { setOperationError(mediaError(error, "No se pudo actualizar el contenido.")); }
  };
  const openEdit = async (item: MediaItem) => {
    setOperationError(null); setFeedback(null);
    try { const detail = await fetchDetail(item.id).unwrap(); setEditing(detail); setEditName(detail.name); }
    catch (error) { setOperationError(mediaError(error, "No se pudo obtener el contenido.")); }
  };

  return <ManagementShell active="content" title="Contenido multimedia" subtitle="Organiza las imágenes y videos disponibles para tus televisores.">
    {feedback && <p role="status" className="mb-4 flex items-center justify-between rounded-xl border border-[#b8dfcc] bg-[#eff9f4] px-4 py-3 text-sm text-[#076c3a]">{feedback}<button type="button" onClick={() => setFeedback(null)} aria-label="Cerrar aviso"><X size={17} /></button></p>}
    {operationError && !editing && !deleting && <p role="alert" className="mb-4 rounded-xl bg-[#fff0f0] p-4 text-sm text-[#b4232c]">{operationError}</p>}
    <section className="mb-5 grid gap-5 rounded-2xl border border-[#dce5e1] bg-white p-5 shadow-[0_8px_25px_rgba(25,45,38,.05)] lg:grid-cols-[minmax(260px,1fr)_auto] lg:items-center">
      <label className="flex h-14 items-center gap-3 rounded-xl border border-[#d5dfda] px-4 focus-within:border-[#08783f] focus-within:ring-3 focus-within:ring-[#08783f]/10"><Search size={23} className="text-[#64756e]" /><input value={query} onChange={(event) => { setQuery(event.target.value); commitSearch(event.target.value); }} placeholder="Buscar archivo..." className="min-w-0 flex-1 border-0 bg-transparent text-lg outline-none" /></label>
      <div className="flex items-center gap-2"><button type="button" onClick={() => refetch()} disabled={isFetching || saving} aria-label="Actualizar contenido" title="Actualizar contenido" className="grid size-14 shrink-0 place-items-center rounded-xl border border-[#d8dfdc] text-[#08783f] hover:bg-[#f0f8f4] disabled:opacity-50"><RefreshCw size={18} className={isFetching ? "animate-spin" : ""} /></button>{can("content.upload") ? <><button type="button" disabled={saving} onClick={pendingFiles.length > 0 ? savePending : () => inputRef.current?.click()} className="flex h-14 items-center justify-center gap-2 rounded-xl bg-[#08783f] px-5 text-lg font-semibold text-white transition hover:bg-[#066734]">{pendingFiles.length > 0 ? <><Save size={21} />{uploadState.isLoading ? "Subiendo…" : "Guardar"}</> : <><Upload size={22} />Seleccionar</>}</button><input ref={inputRef} type="file" multiple accept="image/*,video/*" className="sr-only" onChange={(event) => stageFiles(event.target.files)} /></> : <span className="flex h-14 items-center justify-center rounded-xl bg-[#eef2f0] px-4 text-sm font-semibold text-[#738079]">Solo lectura</span>}</div>
      {pendingFiles.length > 0 && <div className="col-span-full flex flex-col gap-3 border-t border-[#e4ebe7] pt-4 lg:flex-row lg:items-center"><div className="flex shrink-0 items-center gap-3 rounded-xl bg-[#edf8f3] px-4 py-3 text-[#08783f]"><span className="grid size-10 place-items-center rounded-lg bg-white shadow-sm"><Files size={21} /></span><span><strong className="block text-lg leading-5">{pendingFiles.length}</strong><small className="text-[#687972]">de 6 seleccionados</small></span></div><div className="flex min-w-0 flex-1 gap-3 overflow-x-auto pb-1">{pendingFiles.map((pending) => <button key={pending.id} type="button" onClick={() => setExpandedPendingId(pending.id)} className="group relative flex h-18 min-w-48 max-w-60 items-center gap-3 rounded-xl border border-[#d7e4de] bg-[#fafcfb] p-2 text-left transition hover:border-[#73b697] hover:bg-[#f0f9f5]"><span className="relative grid size-13 shrink-0 place-items-center overflow-hidden rounded-lg bg-[#dff0e8] text-[#08783f]">{pending.kind === "IMAGE" ? <Image src={pending.url} alt="" fill unoptimized className="object-cover" /> : <FileVideo size={25} />}</span><span className="min-w-0"><strong className="block truncate text-sm">{pending.file.name}</strong><small className="text-[#718079]">{pending.kind === "VIDEO" ? "Video" : "Imagen"} · {formatSize(pending.file.size)}</small></span><span role="button" tabIndex={0} aria-label={`Quitar ${pending.file.name}`} onClick={(event) => { event.stopPropagation(); discardPending(pending.id); }} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); event.stopPropagation(); discardPending(pending.id); } }} className="absolute right-1.5 top-1.5 grid size-6 place-items-center rounded-full bg-white text-[#6f7c76] opacity-0 shadow-sm transition hover:text-[#c43e47] group-hover:opacity-100"><X size={14} /></span></button>)}</div>{pendingFiles.length < 6 && <button type="button" onClick={() => inputRef.current?.click()} className="flex h-11 shrink-0 items-center justify-center gap-2 rounded-xl border border-[#9ec8b5] px-4 text-sm font-semibold text-[#08783f] hover:bg-[#edf8f3]"><Upload size={17} />Añadir más</button>}</div>}
      {fileError && <p role="alert" className="col-span-full text-sm font-medium text-[#bd3943]">{fileError}</p>}
    </section>

    <div className="grid gap-5 xl:grid-cols-[minmax(360px,.85fr)_minmax(520px,1.35fr)]">
      <section className="space-y-3" aria-busy={isFetching}>
        {isFetching && <p role="status" className="p-4 text-[#718079]">Cargando contenido…</p>}
        {listError && <p role="alert" className="rounded-xl bg-[#fff0f0] p-4 text-[#b4232c]">{mediaError(listError, "No se pudo cargar el contenido.")}</p>}
        {visibleItems.map((item, index) => <article key={item.id} onClick={() => { setSelectedId(item.id); }} className={`group flex cursor-pointer items-center gap-4 rounded-2xl border p-4 transition ${selected?.id === item.id ? "border-[#159765] bg-[#edf8f3] shadow-[0_8px_22px_rgba(8,120,63,.08)]" : "border-[#dce4e0] bg-white hover:border-[#9fc9b5]"}`}>
          <MediaThumbnail item={item} index={index} />
          <span className="min-w-0 flex-1"><strong className="block truncate text-lg">{item.name}</strong><small className="mt-1 block text-[#687972]">{item.kind === "VIDEO" ? "Video" : "Imagen"}{item.duration ? ` · ${item.duration}` : ""} · {formatSize(item.size)}</small></span>
          <span className="flex items-center gap-1">{can("content.upload") && <button type="button" onClick={(event) => { event.stopPropagation(); void openEdit(item); }} className="grid size-9 place-items-center rounded-lg text-[#146be8] hover:bg-white" aria-label={`Editar ${item.name}`}><Pencil size={18} /></button>}{can("content.delete") && <button type="button" onClick={(event) => { event.stopPropagation(); setOperationError(null); setDeleting(item); }} className="grid size-9 place-items-center rounded-lg text-[#a14b51] hover:bg-[#fff0f1] group-hover:opacity-100" aria-label={`Eliminar ${item.name}`}><Trash2 size={17} /></button>}</span>
        </article>)}
        {!isFetching && !listError && visibleItems.length === 0 && <div className="rounded-2xl border border-dashed border-[#cfdad5] bg-white py-16 text-center text-[#718079]">No se encontraron archivos.</div>}
        {!listError && total > 0 && <footer className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#dce4e0] bg-white p-4">
          <p className="text-sm text-[#66736d]">Mostrando <strong>{(currentPage - 1) * PAGE_SIZE + 1}</strong>–<strong>{Math.min(currentPage * PAGE_SIZE, total)}</strong> de <strong>{total}</strong> archivos</p>
          <nav aria-label="Paginación de contenido" className="flex items-center rounded-xl border border-[#d8dfdc]">
            <button type="button" onClick={() => setPage(currentPage - 1)} disabled={currentPage <= 1 || isFetching} aria-label="Página anterior" className="grid size-10 place-items-center text-[#52625a] hover:bg-[#f0f8f4] disabled:opacity-40"><ChevronLeft size={18} /></button>
            <span aria-live="polite" className="px-3 text-sm font-semibold text-[#08783f]">{currentPage} / {totalPages}</span>
            <button type="button" onClick={() => setPage(currentPage + 1)} disabled={currentPage >= totalPages || isFetching} aria-label="Página siguiente" className="grid size-10 place-items-center text-[#52625a] hover:bg-[#f0f8f4] disabled:opacity-40"><ChevronRight size={18} /></button>
          </nav>
        </footer>}
      </section>

      <section className="rounded-2xl border border-[#dce4e0] bg-white p-5 shadow-[0_8px_25px_rgba(25,45,38,.05)]">
        <h2 className="mb-4 text-xl font-bold">Vista previa</h2>
        {selected ? <><div className="relative aspect-video overflow-hidden rounded-xl bg-[#07110d] text-white">
          {selected.kind === "IMAGE" ? <Image src={selected.url} alt={selected.name} fill unoptimized className="object-contain" /> : <video key={selected.id} src={selected.url} controls preload="metadata" className="h-full w-full object-contain" />}
        </div><div className="mt-4"><h3 className="text-xl font-bold">{selected.name}</h3><p className="mt-1 text-[#687972]">{selected.kind === "VIDEO" ? "Video" : "Imagen"}{selected.duration ? ` · ${selected.duration}` : ""} · {formatSize(selected.size)}</p></div></> : <div className="grid aspect-video place-items-center rounded-xl bg-[#f1f5f3] text-[#708078]">Selecciona un archivo para ver su contenido.</div>}
      </section>
    </div>
    {editing && <div className="fixed inset-0 z-60 grid place-items-center bg-black/55 p-4"><form onSubmit={saveEdit} className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl"><header className="mb-5 flex items-center justify-between"><h2 className="text-xl font-bold">Editar contenido</h2><button type="button" disabled={saving} onClick={() => setEditing(null)} aria-label="Cerrar edición"><X size={20} /></button></header><label className="block text-sm font-semibold">Nombre del archivo<input required value={editName} onChange={(event) => setEditName(event.target.value)} className="mt-2 h-12 w-full rounded-xl border border-[#d8dfdc] px-4 outline-none focus:border-[#08783f]" /></label>{operationError && <p role="alert" className="mt-4 text-sm text-[#b4232c]">{operationError}</p>}<footer className="mt-6 flex justify-end gap-3"><button type="button" onClick={() => setEditing(null)} className="h-11 rounded-xl border border-[#d8dfdc] px-5">Cancelar</button><button disabled={saving || !editName.trim()} className="h-11 rounded-xl bg-[#08783f] px-5 font-semibold text-white disabled:opacity-50">Guardar cambios</button></footer></form></div>}
    {deleting && <div className="fixed inset-0 z-60 grid place-items-center bg-black/55 p-4"><section className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl"><h2 className="text-xl font-bold">Eliminar contenido</h2><p className="mt-3 text-sm text-[#66736d]">Se eliminará <strong>{deleting.name}</strong> de la biblioteca.</p>{operationError && <p role="alert" className="mt-4 text-sm text-[#b4232c]">{operationError}</p>}<footer className="mt-6 flex justify-end gap-3"><button type="button" disabled={saving} onClick={() => setDeleting(null)} className="h-11 rounded-xl border border-[#d8dfdc] px-5">Cancelar</button><button type="button" disabled={saving} onClick={() => void remove(deleting)} className="h-11 rounded-xl bg-[#c73535] px-5 font-semibold text-white">Eliminar</button></footer></section></div>}
    {expandedPendingId && <PendingPreviewModal item={pendingFiles.find((item) => item.id === expandedPendingId)} onClose={() => setExpandedPendingId(null)} />}
  </ManagementShell>;
}

function PendingPreviewModal({ item, onClose }: { item?: PendingFile; onClose: () => void }) {
  if (!item) return null;
  return <div className="fixed inset-0 z-70 grid place-items-center bg-black/75 p-4 backdrop-blur-sm" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><section className="w-full max-w-5xl overflow-hidden rounded-2xl bg-[#07110d] text-white shadow-2xl"><header className="flex items-center justify-between gap-4 border-b border-white/12 px-5 py-4"><span className="min-w-0"><strong className="block truncate">{item.file.name}</strong><small className="text-white/60">{item.kind === "VIDEO" ? "Video" : "Imagen"} · {formatSize(item.file.size)}</small></span><button type="button" onClick={onClose} className="grid size-10 shrink-0 place-items-center rounded-full bg-white/10 transition hover:bg-white/20" aria-label="Cerrar vista ampliada"><X size={20} /></button></header><div className="grid max-h-[78vh] min-h-80 place-items-center overflow-hidden bg-black">{item.kind === "VIDEO" ? <video src={item.url} controls autoPlay className="max-h-[78vh] w-full object-contain" /> : <Image src={item.url} alt={item.file.name} width={1600} height={900} unoptimized className="max-h-[78vh] w-auto object-contain" />}</div></section></div>;
}

function MediaThumbnail({ item, index }: { item: MediaItem; index: number }) { return <span className={`relative grid h-24 w-40 shrink-0 place-items-center overflow-hidden rounded-xl ${index % 3 === 0 ? "bg-[linear-gradient(135deg,#dcefe7,#8dc9b2)]" : index % 3 === 1 ? "bg-[linear-gradient(135deg,#e6f4f0,#b9e5db)]" : "bg-[linear-gradient(135deg,#dce7ec,#4b7e94)]"}`}>{item.url && item.kind === "IMAGE" ? <Image src={item.url} alt="" fill unoptimized className="object-cover" /> : item.kind === "VIDEO" ? <FileVideo size={35} className="text-[#075f45]" /> : <ImageIcon size={35} className="text-[#08783f]" />}{item.duration && <small className="absolute bottom-2 right-2 rounded-md bg-black/70 px-1.5 py-0.5 text-white">{item.duration}</small>}</span>; }
