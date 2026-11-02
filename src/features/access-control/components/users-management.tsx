"use client";

import { useCallback, useMemo, useState, type ChangeEvent, type FormEvent } from "react";
import { AlertCircle, Check, ChevronLeft, ChevronRight, Eye, EyeOff, LoaderCircle, LockKeyhole, Pencil, Plus, RefreshCw, Search, Trash2, UserRound, X } from "lucide-react";
import {
  useCreateUserMutation, useDeleteUserMutation, useGetRoleOptionsQuery, useGetUsersQuery, useUpdateUserMutation,
  type BackendRole, type BackendUser,
} from "../api/access-control-api";
import { ManagementShell } from "./management-shell";
import { useDebouncedCallback } from "../hooks/use-debounced-callback";

type UserStatus = "ACTIVO" | "INACTIVO";
type UserForm = { name: string; ci: string; username: string; password: string; roleId: string; status: UserStatus };
const emptyUser: UserForm = { name: "", ci: "", username: "", password: "", roleId: "", status: "ACTIVO" };

function buildUsername(name: string) { return name.trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9]/g, ""); }
function buildPassword(ci: string) { const clean = ci.replace(/\s/g, ""); return clean ? `${clean}@Tv#` : ""; }
const isProtectedUser = (user: BackendUser) => user.rol?.nombre?.trim().toUpperCase() === "SUPER_ADMIN";
function paginationItems(current: number, total: number): Array<number | "ellipsis"> {
  if (total <= 7) return Array.from({ length: total }, (_, index) => index + 1);
  if (current <= 4) return [1, 2, 3, 4, 5, "ellipsis", total];
  if (current >= total - 3) return [1, "ellipsis", total - 4, total - 3, total - 2, total - 1, total];
  return [1, "ellipsis", current - 1, current, current + 1, "ellipsis", total];
}
function errorMessage(error: unknown, fallback: string) {
  if (!error || typeof error !== "object") return fallback;
  const data = (error as { data?: unknown }).data;
  if (data && typeof data === "object") {
    const value = (data as Record<string, unknown>).message ?? (data as Record<string, unknown>).error;
    if (typeof value === "string" && value.trim()) return value;
    if (Array.isArray(value)) return value.join(". ");
  }
  return fallback;
}
function lastAccess(value: string | null) {
  if (!value) return "Sin acceso";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat("es-BO", { dateStyle: "medium", timeStyle: "short" }).format(date);
}

export function UsersManagement() {
  const [page, setPage] = useState(1);
  const [query, setQuery] = useState("");
  const [search, setSearch] = useState("");
  const { data: usersPage, isLoading, isFetching, error: usersError, refetch } = useGetUsersQuery({ page, limit: 10, search }, { refetchOnFocus: true, refetchOnMountOrArgChange: true });
  const { data: roleOptions = [], isLoading: rolesLoading, error: rolesError } = useGetRoleOptionsQuery();
  const [createUser, { isLoading: creating }] = useCreateUserMutation();
  const [updateUser, { isLoading: updating }] = useUpdateUserMutation();
  const [deleteUser, { isLoading: deletingNow }] = useDeleteUserMutation();
  const [editing, setEditing] = useState<BackendUser | "new" | null>(null);
  const [deleting, setDeleting] = useState<BackendUser | null>(null);
  const [form, setForm] = useState<UserForm>(emptyUser);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const users = useMemo(() => usersPage?.items ?? [], [usersPage?.items]);
  const roles = useMemo(
    () => roleOptions.filter((role) => role.nombre.trim().toUpperCase() !== "SUPER_ADMIN"),
    [roleOptions],
  );
  const total = usersPage?.total ?? users.length;
  const totalPages = usersPage?.totalPages ?? 1;
  const commitSearch = useDebouncedCallback((value: string) => {
    setPage(1);
    setSearch(value.trim());
  }, 350);
  const handleSearch = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    const value = event.target.value;
    setQuery(value);
    commitSearch(value);
  }, [commitSearch]);

  const openNew = () => {
    setFeedback(null);
    setForm({ ...emptyUser, roleId: roles[0]?.id ?? "" });
    setEditing("new");
  };
  const openEdit = (user: BackendUser) => {
    setFeedback(null);
    setForm({ name: user.nombre_completo, ci: user.cedula_identidad, username: user.usuario, password: "", roleId: user.rol?.id ?? "", status: user.estado });
    setEditing(user);
  };
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const isNew = editing === "new";
    const isSuperAdminEdit = !isNew && editing !== null && isProtectedUser(editing);
    const payload = isSuperAdminEdit
      ? { usuario: form.username.trim(), ...(form.password ? { password: form.password } : {}) }
      : { nombre_completo: form.name.trim(), cedula_identidad: form.ci.trim(), usuario: form.username.trim(), role_id: form.roleId, estado: form.status, ...(form.password ? { password: form.password } : {}) };
    try {
      if (isNew) await createUser({ nombre_completo: form.name.trim(), cedula_identidad: form.ci.trim(), usuario: form.username.trim(), role_id: form.roleId, estado: form.status, password: form.password }).unwrap();
      else if (editing) await updateUser({ id: editing.id, ...payload }).unwrap();
      setEditing(null); setFeedback({ type: "success", text: isNew ? "Usuario registrado correctamente." : "Usuario actualizado correctamente." });
    } catch (error) { setFeedback({ type: "error", text: errorMessage(error, "No se pudo guardar el usuario.") }); }
  };
  const confirmDelete = async () => {
    if (!deleting) return;
    if (isProtectedUser(deleting)) {
      setDeleting(null);
      setFeedback({ type: "error", text: "El usuario SUPER_ADMIN es indispensable para el acceso y no puede eliminarse." });
      return;
    }
    try {
      await deleteUser(deleting.id).unwrap();
      if (users.length === 1 && page > 1) setPage((current) => current - 1);
      setDeleting(null); setFeedback({ type: "success", text: `El usuario “${deleting.nombre_completo}” fue eliminado.` });
    } catch (error) { setFeedback({ type: "error", text: errorMessage(error, "No se pudo eliminar el usuario.") }); }
  };

  return <ManagementShell active="users" title="Usuarios" subtitle="Administra las cuentas que pueden ingresar al sistema.">
    {rolesError && <p role="alert" className="mb-4 text-red-600">No se pudieron cargar los roles. Vuelve a intentarlo.</p>}
    {feedback && <div className={`mb-4 flex items-center justify-between rounded-xl border px-4 py-3 text-sm ${feedback.type === "success" ? "border-[#b8dfcc] bg-[#eff9f4] text-[#076c3a]" : "border-[#f1c5c5] bg-[#fff2f2] text-[#b42323]"}`}><span className="flex items-center gap-2"><AlertCircle size={17} />{feedback.text}</span><button type="button" onClick={() => setFeedback(null)} aria-label="Cerrar aviso"><X size={17} /></button></div>}
    <section className="overflow-hidden rounded-2xl border border-[#dfe6e3] bg-white shadow-[0_10px_30px_rgba(25,45,38,.06)]">
      <div className="flex flex-col gap-3 border-b border-[#e6ebe8] p-5 sm:flex-row sm:items-center sm:justify-between">
        <label className="flex h-11 w-full max-w-sm items-center gap-2 rounded-xl border border-[#d9e1dd] px-3"><Search size={18} className="text-[#718079]" /><input value={query} onChange={handleSearch} placeholder="Buscar usuario..." className="min-w-0 flex-1 border-0 bg-transparent outline-none" /></label>
        <span className="flex gap-2"><button type="button" onClick={() => refetch()} disabled={isFetching} aria-label="Actualizar usuarios" className="grid size-11 place-items-center rounded-xl border border-[#d8dfdc] text-[#08783f] disabled:opacity-50"><RefreshCw size={18} className={isFetching ? "animate-spin" : ""} /></button><button type="button" onClick={openNew} disabled={rolesLoading || roles.length === 0} className="flex h-11 items-center justify-center gap-2 rounded-xl bg-[#08783f] px-5 font-semibold text-white hover:bg-[#066734] disabled:opacity-50"><Plus size={19} />Registrar usuario</button></span>
      </div>
      <div className="overflow-x-auto"><table className="w-full min-w-190 text-left">
        <thead className="bg-[#f7f9f8] text-xs uppercase tracking-wide text-[#738078]"><tr><th className="px-5 py-3">Usuario</th><th className="px-5 py-3">Rol</th><th className="px-5 py-3">Estado</th><th className="px-5 py-3">Último acceso</th><th className="px-5 py-3 text-right">Acciones</th></tr></thead>
        <tbody>
          {usersError && <tr><td colSpan={5} className="px-5 py-8 text-center text-[#b42323]">No se pudieron cargar los usuarios.</td></tr>}
          {!usersError && isLoading && <tr><td colSpan={5} className="px-5 py-10 text-center text-[#748079]"><LoaderCircle className="mx-auto mb-2 animate-spin" />Cargando usuarios...</td></tr>}
          {!usersError && !isLoading && users.length === 0 && <tr><td colSpan={5} className="px-5 py-10 text-center text-[#748079]">{search ? "No hay usuarios que coincidan con la búsqueda." : "Todavía no hay usuarios registrados."}</td></tr>}
          {users.map((user) => <tr key={user.id} className="border-t border-[#edf0ee] hover:bg-[#fafcfb]">
            <td className="px-5 py-4"><span className="flex items-center gap-3"><i className="grid size-10 place-items-center rounded-full bg-[#e7f5ee] not-italic text-[#08783f]"><UserRound size={19} /></i><span><strong className="block">{user.nombre_completo}</strong><small className="block text-[#78827e]">{user.usuario} · C.I. {user.cedula_identidad}</small></span></span></td>
            <td className="px-5 py-4"><span className="inline-flex items-center gap-2">{user.rol?.nombre || "Sin rol"}{isProtectedUser(user) && <LockKeyhole size={14} className="text-[#9a6a0e]" aria-label="Rol protegido" />}</span></td><td className="px-5 py-4"><span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${user.estado === "ACTIVO" ? "bg-[#e2f6ec] text-[#08734c]" : "bg-[#f0f1f1] text-[#68706d]"}`}><i className={`size-2 rounded-full ${user.estado === "ACTIVO" ? "bg-[#16ad72]" : "bg-[#9ba19f]"}`} />{user.estado === "ACTIVO" ? "Activo" : "Inactivo"}</span></td>
            <td className="px-5 py-4 text-sm text-[#66736d]">{lastAccess(user.ultimo_acceso)}</td><td className="px-5 py-4 text-right"><span className="inline-flex gap-1"><button type="button" onClick={() => openEdit(user)} title={isProtectedUser(user) ? "Editar usuario y contraseña" : `Editar ${user.nombre_completo}`} className="inline-flex size-9 items-center justify-center rounded-lg text-[#146be8] hover:bg-[#edf4ff]" aria-label={`Editar ${user.nombre_completo}`}><Pencil size={17} /></button><button type="button" onClick={() => setDeleting(user)} disabled={isProtectedUser(user)} title={isProtectedUser(user) ? "SUPER_ADMIN no puede eliminarse" : `Eliminar ${user.nombre_completo}`} className="inline-flex size-9 items-center justify-center rounded-lg text-[#c73535] hover:bg-[#fff0f0] disabled:cursor-not-allowed disabled:bg-[#f1f3f2] disabled:text-[#a7afab] disabled:opacity-70" aria-label={`Eliminar ${user.nombre_completo}`}>{isProtectedUser(user) ? <LockKeyhole size={16} /> : <Trash2 size={17} />}</button></span></td>
          </tr>)}
        </tbody>
      </table></div>
      {!usersError && !isLoading && total > 0 && <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-[#e6ebe8] px-5 py-4"><p className="text-sm text-[#66736d]">Mostrando <strong>{(page - 1) * 10 + 1}</strong>–<strong>{Math.min((page - 1) * 10 + users.length, total)}</strong> de <strong>{total}</strong> usuarios</p><Pagination page={page} totalPages={totalPages} loading={isFetching} onChange={setPage} /></footer>}
    </section>
    {editing && <UserDialog editing={editing} form={form} roles={roles} saving={creating || updating} setForm={setForm} onClose={() => setEditing(null)} onSubmit={submit} />}
    {deleting && <div className="fixed inset-0 z-70 grid place-items-center bg-black/55 p-4"><section className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl"><span className="mb-4 grid size-12 place-items-center rounded-full bg-[#fff0f0] text-[#c73535]"><Trash2 size={22} /></span><h2 className="text-xl font-bold">Eliminar usuario</h2><p className="mt-2 text-sm leading-6 text-[#66736d]">Se eliminará a <strong className="text-[#17231e]">{deleting.nombre_completo}</strong>. Esta acción no se puede deshacer.</p><div className="mt-6 flex justify-end gap-3"><button type="button" onClick={() => setDeleting(null)} disabled={deletingNow} className="h-11 rounded-xl border border-[#d8dfdc] px-5">Cancelar</button><button type="button" onClick={confirmDelete} disabled={deletingNow} className="flex h-11 items-center gap-2 rounded-xl bg-[#c73535] px-5 font-semibold text-white disabled:opacity-60">{deletingNow ? <LoaderCircle size={18} className="animate-spin" /> : <Trash2 size={18} />}{deletingNow ? "Eliminando..." : "Eliminar usuario"}</button></div></section></div>}
  </ManagementShell>;
}

function Pagination({ page, totalPages, loading, onChange }: { page: number; totalPages: number; loading: boolean; onChange: (page: number) => void }) {
  return <nav aria-label="Paginación de usuarios" className="inline-flex items-center overflow-hidden rounded-xl border border-[#d8dfdc] bg-white shadow-sm"><button type="button" onClick={() => onChange(Math.max(1, page - 1))} disabled={page <= 1 || loading} aria-label="Página anterior" className="grid size-10 place-items-center border-r border-[#d8dfdc] text-[#52625a] disabled:bg-[#f7f9f8] disabled:text-[#b8c0bc]"><ChevronLeft size={18} /></button>{paginationItems(page, totalPages).map((item, index) => item === "ellipsis" ? <span key={`ellipsis-${index}`} className="grid size-10 place-items-center border-r border-[#d8dfdc] text-sm text-[#7a8580]">…</span> : <button key={item} type="button" onClick={() => onChange(item)} disabled={loading} aria-label={`Ir a la página ${item}`} aria-current={page === item ? "page" : undefined} className={`grid size-10 place-items-center border-r border-[#d8dfdc] text-sm font-semibold ${page === item ? "bg-[#08783f] text-white" : "text-[#52625a] hover:bg-[#f0f8f4] hover:text-[#08783f]"}`}>{item}</button>)}<button type="button" onClick={() => onChange(Math.min(totalPages, page + 1))} disabled={page >= totalPages || loading} aria-label="Página siguiente" className="grid size-10 place-items-center text-[#52625a] disabled:bg-[#f7f9f8] disabled:text-[#b8c0bc]"><ChevronRight size={18} /></button></nav>;
}

function UserDialog({ editing, form, roles, saving, setForm, onClose, onSubmit }: { editing: BackendUser | "new"; form: UserForm; roles: BackendRole[]; saving: boolean; setForm: (value: UserForm) => void; onClose: () => void; onSubmit: (event: FormEvent) => void }) {
  const [showPassword, setShowPassword] = useState(false);
  const isSuperAdminEdit = editing !== "new" && isProtectedUser(editing);
  const updateName = (name: string) => setForm({ ...form, name, username: editing === "new" ? buildUsername(name) : form.username });
  const updateCi = (ci: string) => setForm({ ...form, ci, password: editing === "new" ? buildPassword(ci) : form.password });
  const regenerate = () => setForm({ ...form, username: buildUsername(form.name), password: buildPassword(form.ci) });
  return <div className="fixed inset-0 z-60 grid place-items-center overflow-y-auto bg-black/55 p-4" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><form onSubmit={onSubmit} className="my-auto w-full max-w-lg overflow-hidden rounded-3xl bg-white shadow-2xl">
    <header className="flex items-center justify-between border-b border-[#e4e8e6] px-6 py-5"><span><h2 className="text-xl font-bold">{editing === "new" ? "REGISTRAR USUARIO" : "EDITAR USUARIO"}</h2><p className="mt-1 text-sm text-[#7a8280]">{isSuperAdminEdit ? "Solo se puede cambiar el usuario y la contraseña." : "Datos de acceso y rol dentro del sistema"}</p></span><button type="button" onClick={onClose} className="grid size-9 place-items-center rounded-full bg-[#f1f3f2]" aria-label="Cerrar"><X size={18} /></button></header>
    <div className="space-y-4 p-6">{!isSuperAdminEdit && <><Field label="Nombre completo" value={form.name} onChange={updateName} /><Field label="Cédula de identidad" value={form.ci} onChange={updateCi} /></>}
      <section className="rounded-2xl border border-[#cfe5da] bg-[#f2faf6] p-4"><div className="mb-3 flex items-center justify-between gap-3"><span><b className="block text-sm">Credenciales de acceso</b><small className="text-[#687a72]">{isSuperAdminEdit ? "Actualiza las credenciales de esta cuenta protegida." : "Se generan automáticamente y puedes modificarlas."}</small></span>{!isSuperAdminEdit && <button type="button" onClick={regenerate} className="grid size-9 shrink-0 place-items-center rounded-lg text-[#08783f] hover:bg-[#dcefe5]" title="Volver a generar"><RefreshCw size={17} /></button>}</div><Field label="Usuario" value={form.username} onChange={(username) => setForm({ ...form, username })} /><label className="mt-3 block"><b className="mb-1.5 block text-sm">Contraseña {editing !== "new" && <small className="font-normal text-[#75807b]">(opcional)</small>}</b><span className="flex h-12 items-center rounded-xl border border-[#d8dfdc] bg-white px-4 focus-within:border-[#08783f]"><input required={editing === "new"} type={showPassword ? "text" : "password"} value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} className="min-w-0 flex-1 bg-transparent outline-none" autoComplete="new-password" /><button type="button" onClick={() => setShowPassword((visible) => !visible)} className="grid size-8 place-items-center text-[#65756e]" aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}>{showPassword ? <EyeOff size={18} /> : <Eye size={18} />}</button></span></label></section>
      {!isSuperAdminEdit && <><label className="block"><b className="mb-1.5 block text-sm">Rol</b><select required value={form.roleId} onChange={(event) => setForm({ ...form, roleId: event.target.value })} className="h-12 w-full rounded-xl border border-[#d8dfdc] px-4"><option value="" disabled>Seleccionar rol</option>{roles.map((role) => <option key={role.id} value={role.id}>{role.nombre}</option>)}</select></label>
      <label className="block"><b className="mb-1.5 block text-sm">Estado</b><select value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value as UserStatus })} className="h-12 w-full rounded-xl border border-[#d8dfdc] px-4"><option value="ACTIVO">Activo</option><option value="INACTIVO">Inactivo</option></select></label></>}
    </div><footer className="flex justify-end gap-3 border-t border-[#e4e8e6] px-6 py-4"><button type="button" onClick={onClose} className="h-11 rounded-xl border border-[#d8dfdc] px-5">Cancelar</button><button disabled={saving} className="flex h-11 items-center gap-2 rounded-xl bg-[#08783f] px-5 font-semibold text-white disabled:opacity-60">{saving ? <LoaderCircle size={18} className="animate-spin" /> : <Check size={18} />}{saving ? "Guardando..." : editing === "new" ? "Registrar" : "Guardar cambios"}</button></footer>
  </form></div>;
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) { return <label className="block"><b className="mb-1.5 block text-sm">{label}</b><input required value={value} onChange={(event) => onChange(event.target.value)} className="h-12 w-full rounded-xl border border-[#d8dfdc] px-4 outline-none focus:border-[#08783f]" /></label>; }
