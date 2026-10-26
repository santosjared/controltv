"use client";

import { useState, type FormEvent } from "react";
import { AlertTriangle, ChevronLeft, ChevronRight, Monitor, Pencil, Plus, RefreshCw, Search, Trash2, Wifi, WifiOff, X } from "lucide-react";
import { ManagementShell } from "@/features/access-control/components/management-shell";
import { useDeleteTelevisionMutation, useGetTelevisionsPageQuery, useRegisterConnectedTvMutation, useUpdateTelevisionMutation } from "@/features/control-tv/api/televisions-api";
import type { Television } from "@/features/control-tv/types";
import { useAuth } from "@/features/auth/auth-context";
import { useConnectedTvs } from "@/features/control-tv/hooks/use-connected-tvs";
import { tvPresence } from "@/features/control-tv/utils/tv-presence";

import { useDebouncedCallback } from "@/features/access-control/hooks/use-debounced-callback";

function errorMessage(error: unknown, fallback: string) {
  if (!error || typeof error !== "object") return fallback;
  const record = error as Record<string, unknown>;
  const data = record.data && typeof record.data === "object" ? record.data as Record<string, unknown> : record;
  const message = data.message ?? data.error;
  if (typeof message === "string" && message.trim()) return message;
  if (Array.isArray(message)) return message.filter((value) => typeof value === "string").join(". ") || fallback;
  return fallback;
}

function paginationItems(current: number, total: number): Array<number | "ellipsis"> {
  if (total <= 7) return Array.from({ length: total }, (_, index) => index + 1);
  if (current <= 4) return [1, 2, 3, 4, 5, "ellipsis", total];
  if (current >= total - 3) return [1, "ellipsis", total - 4, total - 3, total - 2, total - 1, total];
  return [1, "ellipsis", current - 1, current, current + 1, "ellipsis", total];
}

type TvForm = { tvCode: string; name: string; room: string; location: string; model: string; androidVersion: string; ip: string };
const emptyForm: TvForm = { tvCode: "", name: "", room: "", location: "", model: "", androidVersion: "", ip: "" };

export function TelevisionsTable() {
  const { can } = useAuth();
  const { onlineTvIds, lowSignalTvIds, hasStatusSnapshot, isSocketConnected } = useConnectedTvs();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const commitSearch = useDebouncedCallback((value: string) => { setPage(1); setSearch(value.trim()); }, 350);
  const { currentData: tvPage, isLoading, isFetching, error, refetch } = useGetTelevisionsPageQuery({ page, limit: 10, search }, { refetchOnFocus: true, refetchOnReconnect: true });
  const [registerTv, registerState] = useRegisterConnectedTvMutation();
  const [updateTv, updateState] = useUpdateTelevisionMutation();
  const [deleteTv, deleteState] = useDeleteTelevisionMutation();
  const [query, setQuery] = useState("");
  const [dialog, setDialog] = useState<"new" | Television | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Television | null>(null);
  const [form, setForm] = useState<TvForm>(emptyForm);
  const filtered = tvPage?.items ?? [];
  const total = tvPage?.total ?? 0;
  const totalPages = tvPage?.totalPages ?? 1;
  const currentPage = tvPage?.page ?? page;
  const openNew = () => { setFormError(null); setFeedback(null); setForm(emptyForm); setDialog("new"); };
  const openEdit = (tv: Television) => { setFormError(null); setFeedback(null); setForm({ tvCode: tv.tvCode ?? "", name: tv.name, room: tv.room, location: tv.location ?? "", model: tv.model ?? "", androidVersion: tv.androidVersion ?? "", ip: tv.ip }); setDialog(tv); };
  const submit = async (event: FormEvent) => { event.preventDefault(); setFormError(null); try { if (dialog === "new") await registerTv({ tv_id: form.tvCode.trim(), nombre: form.name.trim(), sala: form.room.trim(), ubicacion: form.location.trim(), model: form.model.trim(), version_android: form.androidVersion.trim(), ip: form.ip.trim() }).unwrap(); else if (dialog) { if (!dialog.roomId) { setFormError("No se puede editar este televisor porque no tiene una sala registrada."); return; } await updateTv({ id: dialog.id, tv_id: form.tvCode.trim(), nombre: form.name.trim(), sala_id: dialog.roomId, sala: form.room.trim(), ubicacion: form.location.trim() }).unwrap(); } setFeedback(dialog === "new" ? "Televisor registrado correctamente." : "Televisor actualizado correctamente."); setDialog(null); } catch (error) { setFormError(errorMessage(error, "No se pudo guardar el televisor.")); } };
  const remove = async () => { if (!deleteTarget) return; setDeleteError(null); try { await deleteTv(deleteTarget.id).unwrap(); if (filtered.length === 1 && currentPage > 1) setPage(currentPage - 1); setFeedback("Televisor eliminado correctamente."); setDeleteTarget(null); } catch (error) { setDeleteError(errorMessage(error, "No se pudo eliminar el televisor.")); } };

  return <ManagementShell active="televisions" title="Televisores" subtitle="Registra y administra los dispositivos disponibles para transmitir contenido.">
    {feedback && <p role="status" className="mb-4 rounded-xl border border-[#b8dfcc] bg-[#eff9f4] px-4 py-3 text-sm text-[#076c3a]">{feedback}</p>}
    <section className="overflow-hidden rounded-2xl border border-[#dfe6e3] bg-white shadow-[0_10px_30px_rgba(25,45,38,.06)]">
      <div className="flex flex-col gap-3 border-b border-[#e6ebe8] p-5 md:flex-row md:items-center md:justify-between"><label className="flex h-11 w-full max-w-md items-center gap-2 rounded-xl border border-[#d9e1dd] px-3"><Search size={18} className="text-[#718079]" /><input value={query} onChange={(event) => { setQuery(event.target.value); commitSearch(event.target.value); }} placeholder="Buscar televisor, sala, código o IP..." className="min-w-0 flex-1 border-0 bg-transparent outline-none" /></label><span className="flex gap-2"><button onClick={() => refetch()} disabled={isFetching} className="grid size-11 place-items-center rounded-xl border border-[#d8e1dd] text-[#557168] hover:bg-[#f0f5f2]" aria-label="Actualizar televisores"><RefreshCw size={18} className={isFetching ? "animate-spin" : ""} /></button>{can("televisions.register") && <button onClick={openNew} className="flex h-11 items-center gap-2 rounded-xl bg-[#08783f] px-5 font-semibold text-white hover:bg-[#066734]"><Plus size={19} />Agregar televisor</button>}</span></div>
      <div className="overflow-x-auto"><table className="w-full min-w-285 text-left"><thead className="bg-[#f7f9f8] text-xs uppercase tracking-wide text-[#738078]"><tr><th className="px-4 py-3">Televisor</th><th className="px-4 py-3">Sala</th><th className="px-4 py-3">Ubicación</th><th className="px-4 py-3">Código TV</th><th className="px-4 py-3">Modelo</th><th className="px-4 py-3">Android</th><th className="px-4 py-3">Dirección IP</th><th className="px-4 py-3">Estado</th><th className="px-4 py-3 text-right">Acciones</th></tr></thead><tbody>{filtered.map((tv) => { const presence = tvPresence(tv.tvCode ?? tv.id, isSocketConnected, hasStatusSnapshot, onlineTvIds, lowSignalTvIds); const online = presence === "online" || presence === "low-signal"; const presenceLabel = presence === "online" ? "En línea" : presence === "low-signal" ? "Señal baja" : presence === "offline" ? "Sin conexión" : isSocketConnected ? "Verificando…" : "Sin confirmar"; return <tr key={tv.id} className="border-t border-[#edf0ee] hover:bg-[#fafcfb]"><td className="px-4 py-4"><span className="flex items-center gap-3"><i className="grid size-10 place-items-center rounded-xl bg-[#e7f5ee] not-italic text-[#08783f]"><Monitor size={20} /></i><strong className="max-w-44 truncate">{tv.name}</strong></span></td><td className="px-4 py-4">{tv.room}</td><td className="px-4 py-4 text-[#66736d]">{tv.location || "—"}</td><td className="px-4 py-4 font-mono text-sm">{tv.tvCode || "—"}</td><td className="px-4 py-4">{tv.model || "—"}</td><td className="px-4 py-4">{tv.androidVersion || "—"}</td><td className="px-4 py-4 font-mono text-sm">{tv.ip}</td><td className="px-4 py-4"><span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${presence === "unknown" ? "bg-[#eef2f0] text-[#68766f]" : presence === "low-signal" ? "bg-[#fff1cc] text-[#8a6210]" : online ? "bg-[#e2f6ec] text-[#08734c]" : "bg-[#ffe7e8] text-[#b92f38]"}`}>{online ? <Wifi size={14} /> : <WifiOff size={14} />}{presenceLabel}</span></td><td className="px-4 py-4 text-right">{can("televisions.edit") && <button onClick={() => openEdit(tv)} className="inline-grid size-9 place-items-center rounded-lg text-[#146be8] hover:bg-[#edf4ff]" aria-label={`Editar ${tv.name}`}><Pencil size={17} /></button>}{can("televisions.delete") && <button onClick={() => { setDeleteError(null); setFeedback(null); setDeleteTarget(tv); }} className="inline-grid size-9 place-items-center rounded-lg text-[#c23e46] hover:bg-[#fff0f1]" aria-label={`Eliminar ${tv.name}`}><Trash2 size={17} /></button>}{!can("televisions.edit") && !can("televisions.delete") && <span className="text-[#98a29d]">—</span>}</td></tr>; })}</tbody></table></div>
      {isLoading && <p className="p-8 text-center text-[#718079]">Cargando televisores…</p>}{error && <div className="m-5 flex items-center gap-3 rounded-xl bg-[#fff2f2] p-4 text-[#a72e36]"><AlertTriangle size={20} /><span>{errorMessage(error, "No se pudieron cargar los televisores.")}</span></div>}{!isLoading && !isFetching && !error && filtered.length === 0 && <p className="p-10 text-center text-[#718079]">No se encontraron televisores.</p>}
      {!error && total > 0 && <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-[#e6ebe8] px-5 py-4">
        <p className="text-sm text-[#66736d]">Mostrando <strong>{(currentPage - 1) * (tvPage?.limit ?? 10) + 1}</strong>–<strong>{Math.min(currentPage * (tvPage?.limit ?? 10), total)}</strong> de <strong>{total}</strong> televisores</p>
        <nav aria-label="Paginación de televisores" className="inline-flex items-center overflow-hidden rounded-xl border border-[#d8dfdc]">
          <button type="button" onClick={() => setPage(currentPage - 1)} disabled={currentPage <= 1 || isFetching} aria-label="Página anterior" className="grid size-10 place-items-center text-[#52625a] hover:bg-[#f0f8f4] disabled:opacity-40"><ChevronLeft size={18} /></button>
          {paginationItems(currentPage, totalPages).map((item, index) => item === "ellipsis" ? <span key={"ellipsis-" + index} className="grid size-10 place-items-center">…</span> : <button type="button" key={item} onClick={() => setPage(item)} disabled={isFetching} aria-label={"Ir a la página " + item} aria-current={currentPage === item ? "page" : undefined} className={"grid size-10 place-items-center border-x border-[#d8dfdc] text-sm font-semibold " + (currentPage === item ? "bg-[#08783f] text-white" : "text-[#52625a] hover:bg-[#f0f8f4]")}>{item}</button>)}
          <button type="button" onClick={() => setPage(currentPage + 1)} disabled={currentPage >= totalPages || isFetching} aria-label="Página siguiente" className="grid size-10 place-items-center text-[#52625a] hover:bg-[#f0f8f4] disabled:opacity-40"><ChevronRight size={18} /></button>
        </nav>
      </footer>}
    </section>

    {dialog && <TvDialog mode={dialog === "new" ? "new" : "edit"} form={form} setForm={setForm} loading={registerState.isLoading || updateState.isLoading} error={formError ?? (dialog !== "new" && !dialog.roomId ? "No se puede editar este televisor porque no tiene una sala registrada." : null)} onClose={() => setDialog(null)} onSubmit={submit} />}
    {deleteTarget && <div className="fixed inset-0 z-60 grid place-items-center bg-black/55 p-4"><section className="w-full max-w-md overflow-hidden rounded-3xl bg-white shadow-2xl"><header className="flex justify-between border-b border-[#e4e8e6] px-6 py-5"><span><h2 className="text-xl font-bold">ELIMINAR TELEVISOR</h2><p className="mt-1 text-sm text-[#7a8280]">Esta acción no se puede deshacer.</p></span><button onClick={() => setDeleteTarget(null)} className="grid size-9 place-items-center rounded-full bg-[#f1f3f2]"><X size={18} /></button></header><div className="p-6"><div className="rounded-r-xl border-l-3 border-[#d74747] bg-[#fff3f3] p-4"><strong>{deleteTarget.name}</strong><p className="mt-1 text-sm text-[#69746f]">{deleteTarget.room} · {deleteTarget.tvCode}</p></div>{deleteError && <p role="alert" className="mt-4 text-sm text-[#b4232c]">{deleteError}</p>}</div><footer className="flex justify-end gap-3 border-t border-[#e4e8e6] px-6 py-4"><button onClick={() => setDeleteTarget(null)} className="h-11 rounded-xl border border-[#d8dfdc] px-5">Cancelar</button><button onClick={() => void remove()} disabled={deleteState.isLoading} className="h-11 rounded-xl bg-[#d74747] px-5 font-semibold text-white">{deleteState.isLoading ? "Eliminando…" : "Eliminar"}</button></footer></section></div>}
  </ManagementShell>;
}

function TvDialog({ mode, form, setForm, loading, error, onClose, onSubmit }: { mode: "new" | "edit"; form: TvForm; setForm: (form: TvForm) => void; loading: boolean; error: string | null; onClose: () => void; onSubmit: (event: FormEvent) => void }) {
  const field = (key: keyof TvForm, label: string, placeholder: string, disabled = false) => <label className="block"><b className="mb-1.5 block text-sm">{label}</b><input required disabled={disabled} value={form[key]} onChange={(event) => setForm({ ...form, [key]: event.target.value })} placeholder={placeholder} className="h-12 w-full rounded-xl border border-[#d8dfdc] px-4 outline-none focus:border-[#08783f] disabled:bg-[#f3f5f4] disabled:text-[#78827e]" /></label>;
  return <div className="fixed inset-0 z-60 grid place-items-center overflow-y-auto bg-black/55 p-4" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><form onSubmit={onSubmit} className="my-auto w-full max-w-2xl overflow-hidden rounded-3xl bg-white shadow-2xl"><header className="flex justify-between border-b border-[#e4e8e6] px-6 py-5"><span><h2 className="text-xl font-bold">{mode === "new" ? "AGREGAR TELEVISOR" : "EDITAR TELEVISOR"}</h2><p className="mt-1 text-sm text-[#7a8280]">Información de identificación y ubicación del dispositivo.</p></span><button type="button" onClick={onClose} className="grid size-9 place-items-center rounded-full bg-[#f1f3f2]"><X size={18} /></button></header><div className="grid gap-4 p-6 sm:grid-cols-2">{field("tvCode", "Código TV", "TV-12345678-ABC", mode === "edit")}{field("name", "Nombre del televisor", "TV Emergencias")}{field("room", "Nombre de la sala", "Emergencias")}{field("location", "Ubicación", "Planta baja")}{field("model", "Modelo", "Android TV", mode === "edit")}{field("androidVersion", "Versión Android", "12", mode === "edit")}{field("ip", "Dirección IP", "192.168.1.20", mode === "edit")}</div>{error && <p role="alert" className="mx-6 mb-4 rounded-xl bg-[#fff0f0] px-4 py-3 text-sm text-[#b4232c]">{error}</p>}<footer className="flex justify-end gap-3 border-t border-[#e4e8e6] px-6 py-4"><button type="button" onClick={onClose} className="h-11 rounded-xl border border-[#d8dfdc] px-5">Cancelar</button><button disabled={loading} className="h-11 rounded-xl bg-[#08783f] px-5 font-semibold text-white">{loading ? "Guardando…" : mode === "new" ? "Agregar televisor" : "Guardar cambios"}</button></footer></form></div>;
}
