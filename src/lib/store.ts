import { configureStore } from "@reduxjs/toolkit";
import { accessControlApi } from "@/features/access-control/api/access-control-api";
import { televisionsApi } from "@/features/control-tv/api/televisions-api";
import { mediaApi } from "@/features/media-library/api/media-api";
import { playlistsApi } from "@/features/playlists/api/playlists-api";

export const makeStore = () => configureStore({
  reducer: {
    [playlistsApi.reducerPath]: playlistsApi.reducer,
    [mediaApi.reducerPath]: mediaApi.reducer,
    [televisionsApi.reducerPath]: televisionsApi.reducer,
    [accessControlApi.reducerPath]: accessControlApi.reducer,
  },
  middleware: (getDefaultMiddleware) => getDefaultMiddleware().concat(
    televisionsApi.middleware,
    accessControlApi.middleware,
    mediaApi.middleware,
    playlistsApi.middleware,
  ),
});

export type AppStore = ReturnType<typeof makeStore>;
