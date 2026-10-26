"use client";

import { useMemo, useState, type FormEvent } from "react";
import { AlertCircle, Check, ChevronLeft, ChevronRight, KeyRound, LoaderCircle, LockKeyhole, Pencil, Plus, RefreshCw, ShieldCheck, Trash2, X } from "lucide-react";
import {
  useCreateRoleMutation, useDeleteRoleMutation, useGetPermissionsQuery, useGetRolesQuery,
  useLazyGetRoleQuery, useUpdateRoleMutation, type BackendPermission, type BackendRole,
} from "../api/access-control-api";
import { ManagementShell } from "./management-shell";

type RoleForm = { name: string; description: string; permissionIds: string[] };
const emptyRole: RoleForm = { name: "", description: "", permissionIds: [] };
const permissionsOf = (role: BackendRole) => role.permisos ?? role.permissions ?? [];
const permissionIdsOf = (role: BackendRole) => [...new Set((role.permission_ids ?? permissionsOf(role).map(({ id }) => id)).filter(Boolean))];
const isProtectedRole = (role: BackendRole) => role.nombre.trim().toUpperCase() === "SUPER_ADMIN";
function userCount(role: BackendRole) {
  if (typeof role.usuarios_count === "number") return role.usuarios_count;
  if (typeof role.cantidad_usuarios === "number") return role.cantidad_usuarios;
  if (typeof role._count?.usuarios === "number") return role._count.usuarios;
  return Array.isArray(role.usuarios) ? role.usuarios.length : null;
}
function errorMessage(error: unknown, fallback: string) {
  if (!error || typeof error !== "object") return fallback;
  const data = (error as { data?: unknown }).data;
  if (data && typeof data === "object") {
    const value = (data as Record<string, unknown>).message ?? (data as Record<string, unknown>).error ?? (data as Record<string, unknown>).detail;
    if (typeof value === "string" && value.trim()) return value;
    if (Array.isArray(value)) return value.join(". ");
  }
  return fallback;
}

function paginationItems(current: number, total: number): Array<number | "ellipsis"> {
  if (total <= 7) return Array.from({ length: total }, (_, index) => index + 1);
  if (current <= 4) return [1, 2, 3, 4, 5, "ellipsis", total];
  if (current >= total - 3) return [1, "ellipsis", total - 4, total - 3, total - 2, total - 1, total];
  return [1, "ellipsis", current - 1, current, current + 1, "ellipsis", total];
}

export function RolesManagement() {
  const [page, setPage] = useState(1);
  const { data: rolesPage, isLoading, isFetching, error: rolesError, refetch } = useGetRolesQuery({ page, limit: 10 }, { refetchOnFocus: true, refetchOnMountOrArgChange: true });
  const roles = rolesPage?.items ?? [];
  const total = rolesPage?.total ?? roles.length;
  const totalPages = rolesPage?.totalPages ?? 1;
  const { data: permissions = [], isLoading: permissionsLoading, error: permissionsError } = useGetPermissionsQuery();
  const [fetchRole] = useLazyGetRoleQuery();
  const [createRole, { isLoading: creating }] = useCreateRoleMutation();
  const [updateRole, { isLoading: updating }] = useUpdateRoleMutation();
  const [deleteRole, { isLoading: deletingNow }] = useDeleteRoleMutation();
  const [editing, setEditing] = useState<BackendRole | "new" | null>(null);
  const [loadingRoleId, setLoadingRoleId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<BackendRole | null>(null);
  const [form, setForm] = useState<RoleForm>(emptyRole);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const groupedPermissions = useMemo(() => permissions.reduce<Record<string, BackendPermission[]>>((groups, permission) => {
    (groups[permission.modulo?.trim() || "General"] ??= []).push(permission);
    return groups;
  }, {}), [permissions]);

  const openNew = () => { setFeedback(null); setForm(emptyRole); setEditing("new"); };
  const openEdit = async (role: BackendRole) => {
    if (isProtectedRole(role)) {
      setFeedback({ type: "error", text: "SUPER_ADMIN es un rol protegido y no puede modificarse." });
      return;
    }
    setFeedback(null); setLoadingRoleId(role.id);
    try {
      const detail = await fetchRole(role.id, false).unwrap();
      setForm({ name: detail.nombre, description: detail.descripcion ?? "", permissionIds: permissionIdsOf(detail) });
      setEditing(detail);
    } catch (error) { setFeedback({ type: "error", text: errorMessage(error, "No se pudo cargar el detalle del rol.") }); }
    finally { setLoadingRoleId(null); }
  };
  const togglePermission = (id: string) => setForm((current) => ({ ...current, permissionIds: current.permissionIds.includes(id) ? current.permissionIds.filter((value) => value !== id) : [...current.permissionIds, id] }));
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (editing !== "new" && editing && isProtectedRole(editing)) {
      setEditing(null);
      setFeedback({ type: "error", text: "SUPER_ADMIN es un rol protegido y no puede modificarse." });
      return;
    }
    const wasNew = editing === "new";
    const payload = { nombre: form.name.trim(), descripcion: form.description.trim(), permission_ids: form.permissionIds };
    try {
      if (wasNew) await createRole(payload).unwrap();
      else if (editing) await updateRole({ id: editing.id, ...payload }).unwrap();
      setEditing(null); setFeedback({ type: "success", text: wasNew ? "Rol creado correctamente." : "Rol actualizado correctamente." });
    } catch (error) { setFeedback({ type: "error", text: errorMessage(error, "No se pudo guardar el rol.") }); }
  };
  const confirmDelete = async () => {
    if (!deleting) return;
    if (isProtectedRole(deleting)) {
      setDeleting(null);
      setFeedback({ type: "error", text: "SUPER_ADMIN es indispensable para el acceso y no puede eliminarse." });
      return;
    }
    try {
      await deleteRole(deleting.id).unwrap();
      if (roles.length === 1 && page > 1) setPage((current) => current - 1);
      setFeedback({ type: "success", text: `El rol “${deleting.nombre}” fue eliminado.` }); setDeleting(null);
    }
    catch (error) { setFeedback({ type: "error", text: errorMessage(error, "No se pudo eliminar el rol.") }); }
  };
  const saving = creating || updating;

  return <ManagementShell active="roles" title="Roles y permisos" subtitle="Define qué acciones puede realizar cada perfil dentro del sistema.">
    {feedback && <div className={`mb-4 flex items-center justify-between rounded-xl border px-4 py-3 text-sm ${feedback.type === "success" ? "border-[#b8dfcc] bg-[#eff9f4] text-[#076c3a]" : "border-[#f1c5c5] bg-[#fff2f2] text-[#b42323]"}`}>
      <span className="flex items-center gap-2"><AlertCircle size={17} />{feedback.text}</span><button type="button" onClick={() => setFeedback(null)} aria-label="Cerrar aviso"><X size={17} /></button>
    </div>}
    <section className="overflow-hidden rounded-2xl border border-[#dfe6e3] bg-white shadow-[0_10px_30px_rgba(25,45,38,.06)]">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#e6ebe8] p-5">
        <span><h2 className="font-bold">Roles del sistema</h2><p className="text-sm text-[#748079]">{isLoading ? "Consultando roles..." : `${total} roles configurados`}</p></span>
        <span className="flex items-center gap-2"><button type="button" onClick={() => refetch()} disabled={isFetching} aria-label="Actualizar roles" className="grid size-11 place-items-center rounded-xl border border-[#d8dfdc] text-[#08783f] hover:bg-[#f0f8f4] disabled:opacity-50"><RefreshCw size={18} className={isFetching ? "animate-spin" : ""} /></button><button type="button" onClick={openNew} className="flex h-11 items-center gap-2 rounded-xl bg-[#08783f] px-5 font-semibold text-white hover:bg-[#066734]"><Plus size={19} />Crear rol</button></span>
      </div>
      <div className="overflow-x-auto"><table className="w-full min-w-190 text-left">
        <thead className="bg-[#f7f9f8] text-xs uppercase tracking-wide text-[#738078]"><tr><th className="px-5 py-3">Rol</th><th className="px-5 py-3">Descripción</th><th className="px-5 py-3">Usuarios</th><th className="px-5 py-3">Permisos</th><th className="px-5 py-3 text-right">Acciones</th></tr></thead>
        <tbody>
          {rolesError && <tr><td colSpan={5} className="px-5 py-8 text-center text-[#b42323]">No se pudieron cargar los roles. Verifica la sesión y la conexión con el backend.</td></tr>}
          {!rolesError && isLoading && <tr><td colSpan={5} className="px-5 py-10 text-center text-[#748079]"><LoaderCircle className="mx-auto mb-2 animate-spin" />Cargando roles...</td></tr>}
          {!rolesError && !isLoading && roles.length === 0 && <tr><td colSpan={5} className="px-5 py-10 text-center text-[#748079]">Todavía no hay roles registrados.</td></tr>}
          {roles.map((role) => <tr key={role.id} className="border-t border-[#edf0ee] hover:bg-[#fbfcfb]">
            <td className="px-5 py-4"><span className="flex items-center gap-3"><i className="grid size-10 place-items-center rounded-xl bg-[#e7f5ee] not-italic text-[#08783f]"><ShieldCheck size={20} /></i><span><strong className="block">{role.nombre}</strong>{isProtectedRole(role) && <small className="mt-1 inline-flex items-center gap-1 rounded-full bg-[#fff3d7] px-2 py-0.5 font-semibold text-[#936510]"><LockKeyhole size={11} />Rol protegido</small>}</span></span></td>
            <td className="max-w-sm px-5 py-4 text-sm text-[#66736d]">{role.descripcion || "Sin descripción"}</td><td className="px-5 py-4">{userCount(role) ?? "—"}</td>
            <td className="px-5 py-4"><span className="rounded-full bg-[#edf3ff] px-2.5 py-1 text-xs font-semibold text-[#315ea8]">{role.permission_ids?.length ?? permissionsOf(role).length} permisos</span></td>
            <td className="px-5 py-4 text-right"><span className="inline-flex gap-1"><button type="button" onClick={() => openEdit(role)} disabled={isProtectedRole(role) || loadingRoleId === role.id} aria-label={`Editar ${role.nombre}`} title={isProtectedRole(role) ? "SUPER_ADMIN no puede modificarse" : `Editar ${role.nombre}`} className="inline-flex size-9 items-center justify-center rounded-lg text-[#146be8] hover:bg-[#edf4ff] disabled:cursor-not-allowed disabled:bg-[#f1f3f2] disabled:text-[#a7afab] disabled:opacity-70">{loadingRoleId === role.id ? <LoaderCircle size={17} className="animate-spin" /> : isProtectedRole(role) ? <LockKeyhole size={16} /> : <Pencil size={17} />}</button><button type="button" onClick={() => setDeleting(role)} disabled={isProtectedRole(role)} aria-label={`Eliminar ${role.nombre}`} title={isProtectedRole(role) ? "SUPER_ADMIN no puede eliminarse" : `Eliminar ${role.nombre}`} className="inline-flex size-9 items-center justify-center rounded-lg text-[#c73535] hover:bg-[#fff0f0] disabled:cursor-not-allowed disabled:bg-[#f1f3f2] disabled:text-[#a7afab] disabled:opacity-70"><Trash2 size={17} /></button></span></td>
          </tr>)}
        </tbody>
      </table></div>
      {!rolesError && !isLoading && total > 0 && <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-[#e6ebe8] px-5 py-4">
        <p className="text-sm text-[#66736d]">Mostrando <strong>{(page - 1) * 10 + 1}</strong>–<strong>{Math.min(page * 10, total)}</strong> de <strong>{total}</strong> roles</p>
        <nav aria-label="Paginación de roles" className="inline-flex items-center overflow-hidden rounded-xl border border-[#d8dfdc] bg-white shadow-sm">
          <button type="button" onClick={() => setPage((current) => Math.max(1, current - 1))} disabled={page <= 1 || isFetching} aria-label="Página anterior" className="grid size-10 place-items-center border-r border-[#d8dfdc] text-[#52625a] transition hover:bg-[#f0f8f4] hover:text-[#08783f] disabled:cursor-not-allowed disabled:bg-[#f7f9f8] disabled:text-[#b8c0bc]"><ChevronLeft size={18} /></button>
          {paginationItems(page, totalPages).map((item, index) => item === "ellipsis"
            ? <span key={`ellipsis-${index}`} className="grid size-10 place-items-center border-r border-[#d8dfdc] text-sm text-[#7a8580]">…</span>
            : <button key={item} type="button" onClick={() => setPage(item)} disabled={isFetching} aria-label={`Ir a la página ${item}`} aria-current={page === item ? "page" : undefined} className={`grid size-10 place-items-center border-r border-[#d8dfdc] text-sm font-semibold transition last:border-r-0 ${page === item ? "bg-[#08783f] text-white" : "text-[#52625a] hover:bg-[#f0f8f4] hover:text-[#08783f]"}`}>{item}</button>)}
          <button type="button" onClick={() => setPage((current) => Math.min(totalPages, current + 1))} disabled={page >= totalPages || isFetching} aria-label="Página siguiente" className="grid size-10 place-items-center text-[#52625a] transition hover:bg-[#f0f8f4] hover:text-[#08783f] disabled:cursor-not-allowed disabled:bg-[#f7f9f8] disabled:text-[#b8c0bc]"><ChevronRight size={18} /></button>
        </nav>
      </footer>}
    </section>

    {editing && <div className="fixed inset-0 z-60 grid place-items-center overflow-y-auto bg-black/55 p-4"><form onSubmit={submit} className="my-auto w-full max-w-3xl overflow-hidden rounded-3xl bg-white shadow-2xl">
      <header className="flex justify-between border-b border-[#e4e8e6] px-6 py-5"><span><h2 className="text-xl font-bold">{editing === "new" ? "CREAR ROL" : "EDITAR ROL"}</h2><p className="mt-1 text-sm text-[#7a8280]">Configura el nombre y los permisos del perfil</p></span><button type="button" onClick={() => setEditing(null)} className="grid size-9 place-items-center rounded-full bg-[#f1f3f2]" aria-label="Cerrar"><X size={18} /></button></header>
      <div className="max-h-[70vh] space-y-5 overflow-y-auto p-6">
        <label className="block"><b className="mb-1.5 block text-sm">Nombre del rol</b><input required value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} className="h-12 w-full rounded-xl border border-[#d8dfdc] px-4 outline-none focus:border-[#08783f]" /></label>
        <label className="block"><b className="mb-1.5 block text-sm">Descripción</b><textarea required value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} rows={3} className="w-full rounded-xl border border-[#d8dfdc] px-4 py-3 outline-none focus:border-[#08783f]" /></label>
        <section><div className="mb-3 flex items-center justify-between gap-3"><h3 className="flex items-center gap-2 font-bold"><KeyRound size={18} className="text-[#08783f]" />Permisos del sistema</h3><span className="text-sm text-[#748079]">{form.permissionIds.length} seleccionados</span></div>
          {permissionsLoading && <p className="rounded-xl bg-[#f7f9f8] p-4 text-sm text-[#748079]">Cargando permisos...</p>}{permissionsError && <p className="rounded-xl bg-[#fff2f2] p-4 text-sm text-[#b42323]">No se pudieron cargar los permisos desde GET /permisos.</p>}
          <div className="space-y-5">{Object.entries(groupedPermissions).map(([moduleName, modulePermissions]) => <section key={moduleName}><h4 className="mb-2 text-xs font-bold uppercase tracking-wider text-[#66736d]">{moduleName}</h4><div className="grid gap-3 sm:grid-cols-2">{modulePermissions.map((permission) => <label key={permission.id} className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3.5 transition ${form.permissionIds.includes(permission.id) ? "border-[#8bcab0] bg-[#eff9f4]" : "border-[#dfe5e2] hover:border-[#b9c8c1]"}`}><input type="checkbox" checked={form.permissionIds.includes(permission.id)} onChange={() => togglePermission(permission.id)} className="mt-0.5 size-4 accent-[#08783f]" /><span><strong className="block text-sm">{permission.nombre}</strong><small className="block text-[#75807b]">{permission.descripcion || ''}</small></span></label>)}</div></section>)}</div>
        </section>
      </div>
      <footer className="flex justify-end gap-3 border-t border-[#e4e8e6] px-6 py-4"><button type="button" onClick={() => setEditing(null)} className="h-11 rounded-xl border border-[#d8dfdc] px-5">Cancelar</button><button disabled={saving || permissionsLoading} className="flex h-11 items-center gap-2 rounded-xl bg-[#08783f] px-5 font-semibold text-white hover:bg-[#066734] disabled:cursor-not-allowed disabled:opacity-60">{saving ? <LoaderCircle size={18} className="animate-spin" /> : <Check size={18} />}{saving ? "Guardando..." : editing === "new" ? "Crear rol" : "Guardar cambios"}</button></footer>
    </form></div>}

    {deleting && <div className="fixed inset-0 z-70 grid place-items-center bg-black/55 p-4"><section className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl"><span className="mb-4 grid size-12 place-items-center rounded-full bg-[#fff0f0] text-[#c73535]"><Trash2 size={22} /></span><h2 className="text-xl font-bold">Eliminar rol</h2><p className="mt-2 text-sm leading-6 text-[#66736d]">Se eliminará el rol <strong className="text-[#17231e]">{deleting.nombre}</strong>. Esta acción no se puede deshacer.</p><div className="mt-6 flex justify-end gap-3"><button type="button" onClick={() => setDeleting(null)} disabled={deletingNow} className="h-11 rounded-xl border border-[#d8dfdc] px-5">Cancelar</button><button type="button" onClick={confirmDelete} disabled={deletingNow} className="flex h-11 items-center gap-2 rounded-xl bg-[#c73535] px-5 font-semibold text-white hover:bg-[#a92d2d] disabled:opacity-60">{deletingNow ? <LoaderCircle size={18} className="animate-spin" /> : <Trash2 size={18} />}{deletingNow ? "Eliminando..." : "Eliminar rol"}</button></div></section></div>}
  </ManagementShell>;
}
