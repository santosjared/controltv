import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react";

export type PlaylistContent = { id: string; contentId: string; name: string; type: "VIDEO" | "IMAGE"; duration: number; order: number };
export type Playlist = { id: string; name: string; description: string; items: PlaylistContent[]; itemCount: number; updatedAt: string };
type PlaylistsPage = { items: Playlist[]; total: number; totalPages: number };
export type PlaylistItemInput = { contenido_id: string; duracion_segundos: number };

export function playlistItemBody(contentId: string, duration: number): PlaylistItemInput {
  if (!Number.isInteger(duration) || duration < 1 || duration > 3600) {
    throw new Error("La duración debe ser un número entero entre 1 y 3600 segundos.");
  }
  return { contenido_id: contentId, duracion_segundos: duration };
}

const object = (value: unknown): Record<string, unknown> => value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};

export function playlistError(error: unknown, fallback: string) {
  const record = object(error);
  const data = object(record.data ?? record);
  const message = data.message ?? data.error;
  if (typeof message === "string" && message.trim()) return message;
  if (Array.isArray(message)) return message.filter((value) => typeof value === "string").join(". ") || fallback;
  return fallback;
}

export function mapPlaylist(payload: unknown): Playlist {
  const root = object(payload);
  const record = object(root.playlist ?? root.data ?? payload);
  if (typeof record.id !== "string" || typeof record.nombre !== "string") throw new Error("El formato de la playlist no es válido.");
  const contents = [record.items, record.contenidos, record.playlist_contenidos].find(Array.isArray) ?? [];
  const items = contents.map((value, index): PlaylistContent => {
    const entry = object(value);
    const content = object(entry.contenido ?? value);
    return {
      id: String(entry.id ?? content.id ?? index), contentId: String(entry.contenido_id ?? content.id ?? ""),
      name: String(content.nombre ?? "Contenido"), type: ["IMAGE", "IMAGEN"].includes(String(content.tipo).toUpperCase()) ? "IMAGE" : "VIDEO",
      duration: Math.max(0, Number(entry.duracion_segundos ?? content.duracion_segundos ?? entry.duracion ?? (["IMAGE", "IMAGEN"].includes(String(content.tipo).toUpperCase()) ? 10 : 0)) || 0),
      order: Number(entry.orden ?? index + 1),
    };
  }).sort((a, b) => a.order - b.order);
  return { id: record.id, name: record.nombre, description: String(record.descripcion ?? ""), items, itemCount: Number(record.cantidad_contenidos ?? object(record._count).items ?? object(record._count).contenidos ?? items.length) || 0, updatedAt: String(record.updated_at ?? record.updatedAt ?? record.fecha_actualizacion ?? "") };
}

export function normalizePlaylistsPage(payload: unknown, args: { page: number; limit: number; search: string }): PlaylistsPage {
  const root = object(payload);
  const data = object(root.data);
  const records = [root, data, object(root.meta), object(root.pagination), object(data.meta), object(data.pagination)];
  const list = Array.isArray(payload) ? payload : [root.items, root.playlists, root.results, root.data, data.items, data.playlists, data.results].find(Array.isArray);
  if (!list) throw new Error("El formato de la lista de playlists no es válido.");
  let items = list.map(mapPlaylist);
  const number = (keys: string[], fallback: number) => {
    for (const record of records) for (const key of keys) if (record[key] != null && Number.isFinite(Number(record[key])) && Number(record[key]) >= 0) return Number(record[key]);
    return fallback;
  };
  const paginated = records.some((record) => ["total", "total_items", "totalItems", "totalCount", "count", "totalPages", "total_pages"].some((key) => record[key] != null));
  if (!paginated && args.search) items = items.filter((item) => `${item.name} ${item.description}`.toLocaleLowerCase().includes(args.search.toLocaleLowerCase()));
  const total = number(["total", "total_items", "totalItems", "totalCount", "count"], items.length);
  return { items: paginated ? items : items.slice((args.page - 1) * args.limit, args.page * args.limit), total, totalPages: Math.max(1, number(["totalPages", "total_pages", "lastPage", "last_page"], Math.ceil(total / args.limit))) };
}

export const playlistsApi = createApi({
  reducerPath: "playlistsApi",
  baseQuery: fetchBaseQuery({ baseUrl: "/api/", timeout: 15000 }),
  tagTypes: ["Playlists"],
  endpoints: (builder) => ({
    getPlaylists: builder.query<PlaylistsPage, { page: number; limit: number; search: string }>({
      query: (params) => ({ url: "playlists", params }),
      transformResponse: (payload: unknown, _meta, args) => normalizePlaylistsPage(payload, args),
      providesTags: ["Playlists"],
    }),
    getPlaylist: builder.query<Playlist, string>({
      query: (id) => `playlists/${encodeURIComponent(id)}`,
      transformResponse: mapPlaylist,
      providesTags: (_result, _error, id) => [{ type: "Playlists", id }],
    }),
    createPlaylist: builder.mutation<unknown, { nombre: string; descripcion: string }>({
      query: (body) => ({ url: "playlists", method: "POST", body }),
      invalidatesTags: (_result, error) => error ? [] : ["Playlists"],
    }),
    updatePlaylist: builder.mutation<unknown, { id: string; nombre: string; descripcion: string }>({
      query: ({ id, ...body }) => ({ url: `playlists/${encodeURIComponent(id)}`, method: "PUT", body }),
      invalidatesTags: (_result, error) => error ? [] : ["Playlists"],
    }),
    deletePlaylist: builder.mutation<unknown, string>({
      query: (id) => ({ url: `playlists/${encodeURIComponent(id)}`, method: "DELETE" }),
      invalidatesTags: (_result, error) => error ? [] : ["Playlists"],
    }),
    duplicatePlaylist: builder.mutation<unknown, string>({
      query: (id) => ({ url: `playlists/${encodeURIComponent(id)}/duplicar`, method: "POST" }),
      invalidatesTags: (_result, error) => error ? [] : ["Playlists"],
    }),
    reorderPlaylist: builder.mutation<unknown, { id: string; item_ids: string[] }>({
      query: ({ id, ...body }) => ({ url: `playlists/${encodeURIComponent(id)}/orden`, method: "PUT", body }),
      invalidatesTags: (_result, error) => error ? [] : ["Playlists"],
    }),
    addPlaylistItem: builder.mutation<unknown, { id: string; body: PlaylistItemInput }>({
      query: ({ id, body }) => ({ url: `playlists/${encodeURIComponent(id)}/items`, method: "POST", body }),
      invalidatesTags: (_result, error) => error ? [] : ["Playlists"],
    }),
    removePlaylistItem: builder.mutation<unknown, { id: string; itemId: string }>({
      query: ({ id, itemId }) => ({ url: `playlists/${encodeURIComponent(id)}/items/${encodeURIComponent(itemId)}`, method: "DELETE" }),
      invalidatesTags: (_result, error) => error ? [] : ["Playlists"],
    }),
  }),
});

export const { useGetPlaylistsQuery, useGetPlaylistQuery, useCreatePlaylistMutation, useUpdatePlaylistMutation, useDeletePlaylistMutation, useDuplicatePlaylistMutation, useReorderPlaylistMutation, useAddPlaylistItemMutation, useRemovePlaylistItemMutation } = playlistsApi;
