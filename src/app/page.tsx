import { ControlTvDashboard } from "@/features/control-tv/components/control-tv-dashboard";
import { StoreProvider } from "./store-provider";

export default function HomePage() {
  return <StoreProvider><ControlTvDashboard /></StoreProvider>;
}
