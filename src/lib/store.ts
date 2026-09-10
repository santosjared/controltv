import { configureStore } from "@reduxjs/toolkit";
import { televisionsApi } from "@/features/control-tv/api/televisions-api";

export const makeStore = () => configureStore({
  reducer: { [televisionsApi.reducerPath]: televisionsApi.reducer },
  middleware: (getDefaultMiddleware) => getDefaultMiddleware().concat(televisionsApi.middleware),
});

export type AppStore = ReturnType<typeof makeStore>;
