import type { PermissionKey, SystemRole, SystemUser } from "./types";

export const permissionOptions: { key: PermissionKey; label: string; group: string }[] = [
  { key: "dashboard.view", label: "Ver panel principal", group: "Panel" },
  { key: "televisions.view", label: "Ver televisores", group: "Televisores" },
  { key: "televisions.register", label: "Registrar televisores", group: "Televisores" },
  { key: "televisions.edit", label: "Editar televisores", group: "Televisores" },
  { key: "televisions.delete", label: "Eliminar televisores", group: "Televisores" },
  { key: "televisions.control", label: "Controlar reproducción y volumen", group: "Televisores" },
  { key: "content.view", label: "Ver biblioteca de contenido", group: "Contenido" },
  { key: "content.upload", label: "Subir imágenes y videos", group: "Contenido" },
  { key: "content.broadcast", label: "Enviar contenido a pantallas", group: "Contenido" },
  { key: "content.delete", label: "Eliminar contenido", group: "Contenido" },
  { key: "playlists.view", label: "Ver playlists", group: "Playlists" },
  { key: "playlists.manage", label: "Crear y editar playlists", group: "Playlists" },
  { key: "users.manage", label: "Administrar usuarios", group: "Seguridad" },
  { key: "roles.manage", label: "Administrar roles y permisos", group: "Seguridad" },
];
export const initialRoles: SystemRole[] = [
  { id: "role-admin", name: "Administrador", description: "Acceso completo a la plataforma.", permissions: permissionOptions.map((item) => item.key) },
  { id: "role-operator", name: "Operador audiovisual", description: "Controla televisores, carga contenido y lo envía a las pantallas.", permissions: ["dashboard.view", "televisions.view", "televisions.control", "content.view", "content.upload", "content.broadcast", "playlists.view", "playlists.manage", "reports.view"] },
  { id: "role-viewer", name: "Consulta", description: "Consulta televisores, contenido y reportes sin realizar cambios.", permissions: ["dashboard.view", "televisions.view", "content.view", "playlists.view", "reports.view"] },
];
export const initialUsers: SystemUser[] = [
  { id: "user-1", name: "Wendy Meriles Acha", email: "wendy@hospital.bo", roleId: "role-admin", status: "ACTIVO", lastAccess: "Hoy, 09:42" },
  { id: "user-2", name: "Carlos Mamani", email: "carlos@hospital.bo", roleId: "role-operator", status: "ACTIVO", lastAccess: "Ayer, 16:18" },
  { id: "user-3", name: "María Flores", email: "maria@hospital.bo", roleId: "role-viewer", status: "INACTIVO", lastAccess: "2 oct., 11:30" },
];
