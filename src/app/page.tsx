import { ControlTvDashboard } from "@/features/control-tv/components/control-tv-dashboard";
import { televisions } from "@/features/control-tv/data/televisions";

export default function HomePage() {
  return <ControlTvDashboard initialTelevisions={televisions} />;
}
