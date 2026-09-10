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

function isTelevision(value: unknown): value is Television {
  if (!value || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  return ["id", "room", "name", "ip", "currentContent"].every((key) => typeof record[key] === "string")
    && ["signal", "volume"].every((key) => typeof record[key] === "number" && Number.isFinite(record[key]))
    && ["playing", "available", "offline"].includes(String(record.status));
}

export const televisionsApi = createApi({
  reducerPath: "televisionsApi",
  baseQuery: fetchBaseQuery({ baseUrl: "/api/", timeout: 15000 }),
  tagTypes: ["Televisions"],
  endpoints: (builder) => ({
    getTelevisions: builder.query<Television[], void>({
      providesTags: ["Televisions"],
      async queryFn(_arg, _api, _extraOptions, baseQuery) {
        const result = await baseQuery("tvs");
        if (result.error) return { error: result.error };
        if (Array.isArray(result.data) && result.data.every(isTelevision)) return { data: result.data };
        const registeredDevices = mapRegisteredTvs(result.data);
        if (registeredDevices) return { data: registeredDevices };
        const connectedDevices = mapConnectedTvs(result.data);
        if (!connectedDevices) {
          return { error: { status: "CUSTOM_ERROR", error: "El formato de /tvs no coincide con el modelo de televisores. Se necesita confirmar el contrato del backend." } };
        }
        return { data: connectedDevices };
      },
    }),
    registerConnectedTv: builder.mutation<unknown, RegisterConnectedTv>({
      query: (input) => ({ url: "tvs/register", method: "POST", body: input }),
      invalidatesTags: ["Televisions"],
    }),
  }),
});

export const { useGetTelevisionsQuery, useRegisterConnectedTvMutation } = televisionsApi;
