export type UserStatus = "ACTIVO" | "INACTIVO";

export type SystemUser = { id: string; name: string; email: string; username?: string; ci?: string; roleId: string; status: UserStatus; lastAccess: string };
export type PermissionKey =
  | "dashboard.view"
  | "televisions.view"
  | "televisions.register"
  | "televisions.edit"
  | "televisions.delete"
  | "televisions.control"
  | "content.view"
  | "content.upload"
  | "content.broadcast"
  | "content.delete"
  | "playlists.view"
  | "playlists.manage"
  | "users.manage"
  | "roles.manage"
  | "reports.view";
export type SystemRole = { id: string; name: string; description: string; permissions: PermissionKey[] };
