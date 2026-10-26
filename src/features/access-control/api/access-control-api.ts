import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react";

export type BackendPermission = {
  id: string;
  clave: string;
  nombre: string;
  modulo: string;
  descripcion: string | null;
};

export type BackendRole = {
  id: string;
  nombre: string;
  descripcion: string | null;
  permisos?: BackendPermission[];
  permissions?: BackendPermission[];
  permission_ids?: string[];
  usuarios_count?: number;
  cantidad_usuarios?: number;
  usuarios?: unknown[];
  _count?: { usuarios?: number };
};

export type SaveRole = {
  nombre: string;
  descripcion: string;
  permission_ids: string[];
};

export type RolesPage = {
  items: BackendRole[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};

export type BackendUser = {
  id: string;
  nombre_completo: string;
  cedula_identidad: string;
  usuario: string;
  estado: "ACTIVO" | "INACTIVO";
  ultimo_acceso: string | null;
  rol: { id: string; nombre: string };
};

export type SaveUser = {
  nombre_completo: string;
  cedula_identidad: string;
  usuario: string;
  password?: string;
  role_id: string;
  estado: "ACTIVO" | "INACTIVO";
};

export type UsersPage = { items: BackendUser[]; page: number; limit: number; total: number; totalPages: number };

function unwrapArray<T>(payload: unknown, keys: string[]): T[] {
  if (Array.isArray(payload)) return payload as T[];
  if (!payload || typeof payload !== "object") return [];
  const record = payload as Record<string, unknown>;
  for (const key of keys) if (Array.isArray(record[key])) return record[key] as T[];
  if (record.data && typeof record.data === "object") return unwrapArray<T>(record.data, keys);
  return [];
}

function unwrapObject<T>(payload: unknown, keys: string[]): T {
  if (!payload || typeof payload !== "object") return payload as T;
  const record = payload as Record<string, unknown>;
  for (const key of keys) if (record[key] && typeof record[key] === "object") return record[key] as T;
  if (record.data && typeof record.data === "object") return unwrapObject<T>(record.data, keys);
  return payload as T;
}

function numberFrom(records: Record<string, unknown>[], keys: string[], fallback: number) {
  for (const record of records) {
    for (const key of keys) {
      const value = Number(record[key]);
      if (Number.isFinite(value) && value >= 0) return value;
    }
  }
  return fallback;
}

function normalizeRolesPage(payload: unknown, requestedPage: number, requestedLimit: number): RolesPage {
  const items = unwrapArray<BackendRole>(payload, ["roles", "items", "results"]);
  const root = payload && typeof payload === "object" && !Array.isArray(payload) ? payload as Record<string, unknown> : {};
  const data = root.data && typeof root.data === "object" && !Array.isArray(root.data) ? root.data as Record<string, unknown> : {};
  const metaCandidate = root.meta ?? root.pagination ?? data.meta ?? data.pagination;
  const meta = metaCandidate && typeof metaCandidate === "object" && !Array.isArray(metaCandidate) ? metaCandidate as Record<string, unknown> : {};
  const records = [root, data, meta];
  const page = Math.max(1, numberFrom(records, ["page", "current_page", "currentPage"], requestedPage));
  const limit = Math.max(1, numberFrom(records, ["limit", "per_page", "perPage", "page_size", "pageSize"], requestedLimit));
  const total = numberFrom(records, ["total", "total_items", "totalItems", "count"], items.length);
  const totalPages = Math.max(1, numberFrom(records, ["total_pages", "totalPages", "last_page", "lastPage"], Math.ceil(total / limit) || 1));
  return { items, page, limit, total, totalPages };
}

function normalizeUsersPage(payload: unknown, requestedPage: number, requestedLimit: number): UsersPage {
  const allItems = unwrapArray<BackendUser>(payload, ["usuarios", "users", "items", "results"]);
  const root = payload && typeof payload === "object" && !Array.isArray(payload) ? payload as Record<string, unknown> : {};
  const data = root.data && typeof root.data === "object" && !Array.isArray(root.data) ? root.data as Record<string, unknown> : {};
  const metaCandidate = root.meta ?? root.pagination ?? data.meta ?? data.pagination;
  const meta = metaCandidate && typeof metaCandidate === "object" && !Array.isArray(metaCandidate) ? metaCandidate as Record<string, unknown> : {};
  const records = [root, data, meta];
  const hasServerPagination = records.some((record) => ["total", "total_items", "totalItems", "total_pages", "totalPages", "last_page", "lastPage"].some((key) => record[key] !== undefined));
  const page = Math.max(1, numberFrom(records, ["page", "current_page", "currentPage"], requestedPage));
  const limit = Math.max(1, numberFrom(records, ["limit", "per_page", "perPage", "itemsPerPage", "page_size", "pageSize"], requestedLimit));
  const total = numberFrom(records, ["total", "total_items", "totalItems", "totalCount", "count"], allItems.length);
  const totalPages = Math.max(1, numberFrom(records, ["total_pages", "totalPages", "last_page", "lastPage"], Math.ceil(total / limit) || 1));
  const items = hasServerPagination ? allItems : allItems.slice((requestedPage - 1) * requestedLimit, requestedPage * requestedLimit);
  return { items, page, limit, total, totalPages };
}

export const accessControlApi = createApi({
  reducerPath: "accessControlApi",
  baseQuery: fetchBaseQuery({ baseUrl: "/api/", timeout: 15000 }),
  tagTypes: ["Roles", "Permissions", "Users"],
  endpoints: (builder) => ({
    getRoles: builder.query<RolesPage, { page: number; limit?: number }>({
      query: ({ page, limit = 10 }) => ({ url: "roles", params: { page, limit } }),
      transformResponse: (payload: unknown, _meta, args) => normalizeRolesPage(payload, args.page, args.limit ?? 10),
      providesTags: (result) => result
        ? [...result.items.map(({ id }) => ({ type: "Roles" as const, id })), { type: "Roles", id: "LIST" }]
        : [{ type: "Roles", id: "LIST" }],
    }),
    getRoleOptions: builder.query<BackendRole[], void>({ query: () => "roles/opciones", providesTags: [{ type: "Roles", id: "LIST" }] }),
    getRole: builder.query<BackendRole, string>({
      query: (id) => `roles/${encodeURIComponent(id)}`,
      transformResponse: (payload: unknown) => unwrapObject<BackendRole>(payload, ["role", "rol"]),
      providesTags: (_result, _error, id) => [{ type: "Roles", id }],
    }),
    getPermissions: builder.query<BackendPermission[], void>({
      query: () => "permisos",
      transformResponse: (payload: unknown) => unwrapArray<BackendPermission>(payload, ["permisos", "permissions", "items"]),
      providesTags: [{ type: "Permissions", id: "LIST" }],
    }),
    createRole: builder.mutation<BackendRole, SaveRole>({
      query: (body) => ({ url: "roles", method: "POST", body }),
      invalidatesTags: [{ type: "Roles", id: "LIST" }],
    }),
    updateRole: builder.mutation<BackendRole, SaveRole & { id: string }>({
      query: ({ id, ...body }) => ({ url: `roles/${encodeURIComponent(id)}`, method: "PUT", body }),
      invalidatesTags: (_result, _error, { id }) => [{ type: "Roles", id }, { type: "Roles", id: "LIST" }, { type: "Users", id: "LIST" }],
    }),
    deleteRole: builder.mutation<void, string>({
      query: (id) => ({ url: `roles/${encodeURIComponent(id)}`, method: "DELETE" }),
      invalidatesTags: (_result, _error, id) => [{ type: "Roles", id }, { type: "Roles", id: "LIST" }],
    }),
    getUsers: builder.query<UsersPage, { page: number; limit?: number; search?: string }>({
      query: ({ page, limit = 10, search = "" }) => ({ url: "usuarios", params: { page, limit, ...(search ? { search } : {}) } }),
      transformResponse: (payload: unknown, _meta, args) => normalizeUsersPage(payload, args.page, args.limit ?? 10),
      providesTags: (result) => result
        ? [...result.items.map(({ id }) => ({ type: "Users" as const, id })), { type: "Users", id: "LIST" }]
        : [{ type: "Users", id: "LIST" }],
    }),
    createUser: builder.mutation<BackendUser, SaveUser & { password: string }>({
      query: (body) => ({ url: "usuarios", method: "POST", body }),
      invalidatesTags: [{ type: "Users", id: "LIST" }],
    }),
    updateUser: builder.mutation<BackendUser, SaveUser & { id: string }>({
      query: ({ id, ...body }) => ({ url: `usuarios/${encodeURIComponent(id)}`, method: "PUT", body }),
      invalidatesTags: (_result, _error, { id }) => [{ type: "Users", id }, { type: "Users", id: "LIST" }],
    }),
    deleteUser: builder.mutation<void, string>({
      query: (id) => ({ url: `usuarios/${encodeURIComponent(id)}`, method: "DELETE" }),
      invalidatesTags: (_result, _error, id) => [{ type: "Users", id }, { type: "Users", id: "LIST" }],
    }),
  }),
});

export const {
  useGetRolesQuery,
  useGetRoleOptionsQuery,
  useLazyGetRoleQuery,
  useGetPermissionsQuery,
  useCreateRoleMutation,
  useUpdateRoleMutation,
  useDeleteRoleMutation,
  useGetUsersQuery,
  useCreateUserMutation,
  useUpdateUserMutation,
  useDeleteUserMutation,
} = accessControlApi;
