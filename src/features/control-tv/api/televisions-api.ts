import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react";
import type { Television } from "../types";
import { mapConnectedTvs, mapRegisteredTvs } from "./tv-adapter";

export type RegisterConnectedTv = {
  tv_id: string;
  model: string;
  version_android: string;
  ip: string;
  nombre?: string;
  sala: string;
  ubicacion: string;
};

export type UpdateTelevision = {
  id: string;
  tv_id: string;
  nombre: string;
  sala_id: string;
  sala: string;
  ubicacion: string;
};

function isTelevision(value: unknown): value is Television {
  if (!value || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  return ["id", "room", "name", "ip", "currentContent"].every((key) => typeof record[key] === "string")
    && typeof record.volume === "number" && Number.isFinite(record.volume)
    && (record.signal === undefined || (typeof record.signal === "number" && Number.isFinite(record.signal)))
    && ["playing", "available", "offline"].includes(String(record.status));
}

type TelevisionsPage = { items: Television[]; total: number; totalPages: number; page: number; limit: number };

function televisionItems(payload: unknown): Television[] | null {
  if (Array.isArray(payload)) {
    if (payload.every(isTelevision)) return payload;
    return mapRegisteredTvs(payload) ?? mapConnectedTvs(payload);
  }
  if (!payload || typeof payload !== "object") return null;
  const record = payload as Record<string, unknown>;
  for (const key of ["items", "tvs", "televisions", "results", "data"]) {
    if (record[key] !== undefined) {
      const items = televisionItems(record[key]);
      if (items) return items;
    }
  }
  return null;
}

function normalizeTelevisionsPage(payload: unknown, args: { page: number; limit: number; search?: string }): TelevisionsPage | null {
  let items = televisionItems(payload);
  if (!items) return null;
  const root = payload && typeof payload === "object" && !Array.isArray(payload) ? payload as Record<string, unknown> : {};
  const data = root.data && typeof root.data === "object" ? root.data as Record<string, unknown> : {};
  const records = [root, data, root.meta, root.pagination, data.meta, data.pagination].filter((value): value is Record<string, unknown> => Boolean(value) && typeof value === "object");
  const number = (keys: string[], fallback: number) => {
    for (const record of records) for (const key of keys) {
      const value = record[key];
      if (value !== undefined && value !== null && Number.isFinite(Number(value)) && Number(value) >= 0) return Number(value);
    }
    return fallback;
  };
  const paginated = records.some((record) => ["total", "total_items", "totalItems", "totalCount", "total_pages", "totalPages", "last_page", "lastPage"].some((key) => record[key] !== undefined));
  if (!paginated && args.search) {
    const search = args.search.toLocaleLowerCase();
    items = items.filter((tv) => [tv.name, tv.room, tv.location, tv.tvCode, tv.ip, tv.model, tv.androidVersion].join(" ").toLocaleLowerCase().includes(search));
  }
  const limit = Math.max(1, number(["limit", "per_page", "perPage", "pageSize", "itemsPerPage"], args.limit));
  const total = paginated ? number(["total", "total_items", "totalItems", "totalCount", "count"], items.length) : items.length;
  const totalPages = Math.max(1, number(["total_pages", "totalPages", "last_page", "lastPage"], Math.ceil(total / limit)));
  const page = Math.min(totalPages, Math.max(1, number(["page", "current_page", "currentPage"], args.page)));
  return { items: paginated ? items : items.slice((page - 1) * limit, page * limit), total, totalPages, page, limit };
}

export const televisionsApi = createApi({
  reducerPath: "televisionsApi",
  baseQuery: fetchBaseQuery({ baseUrl: "/api/", timeout: 15000 }),
  tagTypes: ["Televisions"],
  endpoints: (builder) => ({
    getTelevisionsPage: builder.query<TelevisionsPage, { page: number; limit: number; search?: string }>({
      providesTags: ["Televisions"],
      async queryFn(args, _api, _extraOptions, baseQuery) {
        const result = await baseQuery({ url: "tvs", params: args });
        if (result.error) return { error: result.error };
        const data = normalizeTelevisionsPage(result.data, args);
        return data ? { data } : { error: { status: "CUSTOM_ERROR", error: "El formato de la lista de televisores no es válido." } };
      },
    }),
    getTelevisions: builder.query<Television[], void>({
      providesTags: ["Televisions"],
      async queryFn(_arg, _api, _extraOptions, baseQuery) {
        const devices = new Map<string, Television>();
        for (let page = 1; ; page++) {
          const result = await baseQuery({ url: "tvs", params: { page, limit: 100 } });
          if (result.error) return { error: result.error };
          const batch = normalizeTelevisionsPage(result.data, { page, limit: 100 });
          if (!batch) return { error: { status: "CUSTOM_ERROR", error: "El formato de la lista de televisores no es válido." } };
          const previousSize = devices.size;
          batch.items.forEach((device) => devices.set(device.id, device));
          if (page >= batch.totalPages) break;
          if (devices.size === previousSize) return { error: { status: "CUSTOM_ERROR", error: "No se pudieron cargar todas las páginas de televisores." } };
        }
        return { data: [...devices.values()] };
      },
    }),
    registerConnectedTv: builder.mutation<unknown, RegisterConnectedTv>({
      query: (input) => ({ url: "tvs/register", method: "POST", body: input }),
      invalidatesTags: ["Televisions"],
    }),
    updateTelevision: builder.mutation<unknown, UpdateTelevision>({
      query: ({ id, ...body }) => ({ url: `tvs/${encodeURIComponent(id)}`, method: "PUT", body }),
      invalidatesTags: ["Televisions"],
    }),
    deleteTelevision: builder.mutation<unknown, string>({
      query: (id) => ({ url: `tvs/${encodeURIComponent(id)}`, method: "DELETE" }),
      invalidatesTags: ["Televisions"],
    }),
  }),
});

export const { useGetTelevisionsQuery, useGetTelevisionsPageQuery, useRegisterConnectedTvMutation, useUpdateTelevisionMutation, useDeleteTelevisionMutation } = televisionsApi;
