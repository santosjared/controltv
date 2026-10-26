import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react";

export type MediaItem = { id: string; name: string; kind: "VIDEO" | "IMAGE"; size: number; duration?: string; url: string };
type MediaPage = { items: MediaItem[]; total: number; totalPages: number };

export function mediaError(error: unknown, fallback: string) {
  if (!error || typeof error !== "object") return fallback;
  const record = error as Record<string, unknown>;
  const data = record.data && typeof record.data === "object" ? record.data as Record<string, unknown> : record;
  const message = data.message ?? data.error;
  return typeof message === "string" && message.trim() ? message : Array.isArray(message) ? message.filter((value) => typeof value === "string").join(". ") || fallback : fallback;
}

function object(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

export function mapMedia(value: unknown): MediaItem {
  const item = object(value);
  if (typeof item.id !== "string" || typeof item.nombre !== "string") throw new Error("El formato del contenido no es válido.");
  return { id: item.id, name: item.nombre, kind: ["IMAGE", "IMAGEN"].includes(String(item.tipo).toUpperCase()) ? "IMAGE" : "VIDEO", size: Number(item.tamano_bytes) || 0, url: `/api/contenidos/${encodeURIComponent(item.id)}/archivo` };
}

export function normalizeMediaPage(payload: unknown, args: { page: number; limit: number }): MediaPage {
  const root = object(payload);
  const data = object(root.data);
  const records = [root, data, object(root.meta), object(root.pagination), object(data.meta), object(data.pagination)];
  const list = Array.isArray(payload) ? payload : [root.items, root.contenidos, root.results, root.data, data.items, data.contenidos, data.results].find(Array.isArray);
  if (!list) throw new Error("El formato de la lista de contenido no es válido.");
  const items = list.filter((item) => object(item).deleted !== true).map(mapMedia);
  const number = (keys: string[], fallback: number) => {
    for (const record of records) for (const key of keys) if (record[key] != null && Number.isFinite(Number(record[key])) && Number(record[key]) >= 0) return Number(record[key]);
    return fallback;
  };
  const total = number(["total", "total_items", "totalItems", "totalCount", "count"], items.length);
  const paginated = records.some((record) => ["total", "totalPages", "total_pages", "total_items", "totalItems", "totalCount", "count"].some((key) => record[key] != null));
  return { items: paginated ? items : items.slice((args.page - 1) * args.limit, args.page * args.limit), total, totalPages: Math.max(1, number(["totalPages", "total_pages", "lastPage", "last_page"], Math.ceil(total / args.limit))) };
}

export const mediaApi = createApi({
  reducerPath: "mediaApi",
  baseQuery: fetchBaseQuery({ baseUrl: "/api/", timeout: 120000 }),
  tagTypes: ["Media"],
  endpoints: (builder) => ({
    getMedia: builder.query<MediaPage, { page: number; limit: number; search: string; type?: "VIDEO" | "IMAGEN" }>({
      async queryFn(args, _api, _extraOptions, baseQuery) {
        try {
          if (!args.type) {
            const result = await baseQuery({ url: "contenidos", params: args });
            if (result.error) return { error: result.error };
            return { data: normalizeMediaPage(result.data, args) };
          }
          const expectedKind = args.type === "VIDEO" ? "VIDEO" : "IMAGE";

          // Always calculate category totals from the complete filtered result.
          // A matching first page alone cannot prove that backend totals exclude
          // other categories; switching strategies per page changes the count.
          const allItems = new Map<string, MediaItem>();
          for (let current = 1; ; current++) {
            const response = await baseQuery({ url: "contenidos", params: { ...args, page: current, limit: 100 } });
            if (response.error) return { error: response.error };
            const batch = normalizeMediaPage(response.data, { page: current, limit: 100 });
            const previousSize = allItems.size;
            batch.items.forEach((item) => allItems.set(item.id, item));
            if (current >= batch.totalPages) break;
            if (allItems.size === previousSize) return { error: { status: "CUSTOM_ERROR", error: "No se pudo completar el filtro de contenido." } };
          }
          const items = [...allItems.values()].filter((item) => item.kind === expectedKind);
          return { data: { items: items.slice((args.page - 1) * args.limit, args.page * args.limit), total: items.length, totalPages: Math.max(1, Math.ceil(items.length / args.limit)) } };
        } catch {
          return { error: { status: "CUSTOM_ERROR", error: "El formato de la lista de contenido no es válido." } };
        }
      },
      providesTags: ["Media"],
    }),
    getMediaItem: builder.query<MediaItem, string>({
      query: (id) => `contenidos/${encodeURIComponent(id)}`,
      transformResponse: (payload: unknown) => mapMedia(object(payload).data ?? object(payload).contenido ?? payload),
      providesTags: ["Media"],
    }),
    uploadMedia: builder.mutation<unknown, File[]>({
      query: (files) => {
        const body = new FormData();
        files.forEach((file) => body.append("files", file));
        return { url: "contenidos/archivos", method: "POST", body };
      },
      invalidatesTags: (_result, error) => error ? [] : ["Media"],
    }),
    updateMedia: builder.mutation<unknown, { id: string; nombre: string }>({
      query: ({ id, ...body }) => ({ url: `contenidos/${encodeURIComponent(id)}`, method: "PATCH", body }),
      invalidatesTags: (_result, error) => error ? [] : ["Media"],
    }),
    deleteMedia: builder.mutation<unknown, string>({
      query: (id) => ({ url: `contenidos/${encodeURIComponent(id)}`, method: "DELETE" }),
      invalidatesTags: (_result, error) => error ? [] : ["Media"],
    }),
  }),
});

export const { useGetMediaQuery, useLazyGetMediaItemQuery, useUploadMediaMutation, useUpdateMediaMutation, useDeleteMediaMutation } = mediaApi;
