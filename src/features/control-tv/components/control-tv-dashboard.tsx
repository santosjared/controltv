"use client";

import { useMemo, useState, type CSSProperties } from "react";
import {
  CircleStop,
  MonitorPlay,
  Pause,
  Play,
  RefreshCw,
  Search,
  Send,
  Video,
  Wifi,
} from "lucide-react";
import type { Television, TelevisionStatus } from "../types";

const statusLabels: Record<TelevisionStatus, string> = {
  playing: "Reproduciendo",
  available: "Disponible",
  offline: "Sin conexión",
};

const statusStyles: Record<TelevisionStatus, string> = {
  playing: "bg-[#246bfd]",
  available: "bg-[#20ad78]",
  offline: "bg-[#d74747]",
};

type DashboardProps = { initialTelevisions: Television[] };

export function ControlTvDashboard({ initialTelevisions }: DashboardProps) {
  const [devices, setDevices] = useState(initialTelevisions);
  const [selectedId, setSelectedId] = useState("pediatria");
  const [query, setQuery] = useState("");
  const selected = devices.find((device) => device.id === selectedId) ?? devices[0];
  const visibleDevices = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase("es");
    return normalized
      ? devices.filter((device) => `${device.room} ${device.name}`.toLocaleLowerCase("es").includes(normalized))
      : devices;
  }, [devices, query]);

  const updateSelected = (changes: Partial<Television>) => {
    setDevices((current) => current.map((device) => device.id === selected.id ? { ...device, ...changes } : device));
  };

  const online = devices.filter((device) => device.status !== "offline").length;
  const playing = devices.filter((device) => device.status === "playing").length;

  return (
    <main className="min-h-screen bg-[#f2f2f2] text-[#202226]">
      <header className="flex min-h-27 items-center justify-between bg-[#142033] px-5 py-5 text-white md:px-9">
        <div className="flex items-center gap-4.5">
          <span className="grid size-14 place-items-center rounded-[17px] bg-[#246bfd]">
            <Video aria-hidden="true" size={29} strokeWidth={1.8} />
          </span>
          <span>
            <strong className="block text-[22px] leading-tight tracking-[-0.6px] md:text-[28px]">Control TV</strong>
            <small className="mt-1 block text-[13px] text-[#b7c2d4] md:text-base">Centro de distribución audiovisual</small>
          </span>
        </div>
        <div className="flex items-center gap-3 text-base text-[#d8dfeb]">
          <span className="size-2.5 rounded-full bg-[#39dc9a]" />
          <span className="hidden sm:inline">Sistema operativo</span>
          <button className="ml-1 grid size-10 cursor-pointer place-items-center rounded-md bg-[#d2d5da] text-[#202226] transition hover:bg-white md:ml-5" aria-label="Actualizar dispositivos" title="Actualizar">
            <RefreshCw size={23} />
          </button>
        </div>
      </header>

      <section className="grid grid-cols-1 gap-3.5 px-5 py-5 md:grid-cols-3 md:px-9 md:py-7.5" aria-label="Resumen de dispositivos">
        <Metric label="Televisores" value={devices.length} detail="Dispositivos registrados" />
        <Metric label="En línea" value={online} detail="Listos para transmitir" tone="text-[#20ad78]" />
        <Metric label="Reproduciendo" value={playing} detail="Transmisiones activas" tone="text-[#246bfd]" />
      </section>

      <div className="grid items-start gap-7 px-5 pb-8 xl:grid-cols-[minmax(0,1fr)_450px] xl:px-9">
        <section className="min-w-0">
          <div className="mb-5 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <span>
              <h1 className="my-1 text-[25px] font-semibold">Televisores por sala</h1>
              <p className="m-0 text-[17px] text-[#68696d]">Selecciona un equipo para administrarlo</p>
            </span>
            <label className="flex h-14.5 w-full items-center gap-3 rounded-md border border-[#d6d6d6] bg-white px-4 md:w-72">
              <span className="sr-only">Buscar sala</span>
              <input className="min-w-0 flex-1 border-0 bg-transparent text-[#444] outline-none placeholder:text-[#666]" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar sala..." />
              <Search aria-hidden="true" size={18} strokeWidth={1.7} />
            </label>
          </div>
          <div className="grid max-h-145 grid-cols-1 gap-x-14 gap-y-8 overflow-y-auto px-2 pb-4 sm:grid-cols-2 xl:grid-cols-[repeat(2,minmax(280px,336px))]">
            {visibleDevices.map((device) => (
              <DeviceCard key={device.id} device={device} selected={device.id === selected.id} onSelect={() => setSelectedId(device.id)} />
            ))}
            {visibleDevices.length === 0 && <p className="text-[#666970]">No encontramos salas con ese nombre.</p>}
          </div>
        </section>
        <ControlPanel device={selected} onChange={updateSelected} />
      </div>
    </main>
  );
}

function Metric({ label, value, detail, tone = "text-[#202226]" }: { label: string; value: number; detail: string; tone?: string }) {
  return (
    <article className="flex h-26.25 flex-col rounded-2xl bg-white px-5 py-4 md:h-35 md:px-6 md:py-6">
      <span className="text-base uppercase text-[#5e6064]">{label}</span>
      <strong className={`text-[34px] leading-10 font-medium ${tone}`}>{value}</strong>
      <small className="text-[17px] text-[#65666a]">{detail}</small>
    </article>
  );
}

function DeviceCard({ device, selected, onSelect }: { device: Television; selected: boolean; onSelect: () => void }) {
  return (
    <button
      className={`min-w-0 cursor-pointer rounded-xl border-0 bg-transparent p-0 text-left transition focus-visible:outline-3 focus-visible:outline-[#246bfd]/25 ${selected ? "bg-[#e8e8e8] shadow-[0_0_0_15px_#e8e8e8]" : "hover:-translate-y-0.5"}`}
      onClick={onSelect}
      aria-label={`Administrar ${device.room}`}
    >
      <span className="flex h-17.25 items-start justify-between gap-2">
        <span className="min-w-0">
          <strong className="block truncate text-xl">{device.room}</strong>
          <small className="mt-1 block truncate text-base text-[#696a6d]">{device.name}</small>
        </span>
        <em className={`whitespace-nowrap rounded-2xl px-3.5 py-1.5 text-sm not-italic text-white ${statusStyles[device.status]}`}>{statusLabels[device.status]}</em>
      </span>
      <span className="relative flex h-37.5 items-center justify-center rounded-[14px] bg-[#0d1728] text-white">
        <Video aria-hidden="true" size={58} strokeWidth={1.7} className="text-[#61718b]" />
        <b className="absolute bottom-2.5 left-3.5 text-base font-normal">{device.currentContent}</b>
      </span>
      <span className="flex justify-between pt-4.5 text-base text-[#626468]">
        <span>{device.ip}</span>
        <span className="flex items-center gap-2 text-[#26282b]"><Wifi aria-hidden="true" size={17} />{device.signal}%</span>
      </span>
    </button>
  );
}

function ControlPanel({ device, onChange }: { device: Television; onChange: (changes: Partial<Television>) => void }) {
  return (
    <aside className="h-auto w-full overflow-y-auto rounded-[20px] bg-white px-4.5 py-6 md:max-w-175 md:px-7 md:py-8 xl:h-164">
      <h2 className="m-0 text-[25px] font-semibold">Panel de control</h2>
      <a className="mt-1 mb-6 block text-[17px] text-[#246bfd] no-underline" href={`#${device.id}`}>{device.room}</a>
      <div className="relative flex h-53.5 flex-col items-center justify-center rounded-[14px] bg-[#0d1728] text-white">
        <MonitorPlay aria-hidden="true" size={70} strokeWidth={1.6} className="text-[#61718b]" />
        <span className="absolute bottom-4 left-4.5">
          <small className="block text-xs text-[#9db3d7]">AHORA REPRODUCIENDO</small>
          <strong className="mt-1 block text-base">{device.currentContent}</strong>
        </span>
      </div>
      <div className="my-5.5 grid grid-cols-3 gap-2.5">
        <ActionButton icon={<Play size={20} />} label="Reproducir" onClick={() => onChange({ status: "playing" })} />
        <ActionButton icon={<Pause size={20} />} label="Pausa" onClick={() => onChange({ status: "available" })} />
        <ActionButton icon={<CircleStop size={20} />} label="Detener" onClick={() => onChange({ status: "available", currentContent: "Sin reproducción" })} />
      </div>
      <div className="border-b border-[#e4e5e7] pb-7">
        <strong className="mb-3.5 block">Volumen</strong>
        <span className="mb-3.5 block text-base">{device.volume}%</span>
        <input className="volume-range w-full" aria-label="Volumen" type="range" min="0" max="100" value={device.volume} onChange={(event) => onChange({ volume: Number(event.target.value) })} style={{ "--volume": `${device.volume}%` } as CSSProperties} />
      </div>
      <div>
        <h3 className="my-5 text-[21px] font-semibold">Contenido disponible</h3>
        <select className="h-12 w-full rounded-md border border-[#e4e5e7] bg-white px-3" aria-label="Contenido disponible" value={device.currentContent} onChange={(event) => onChange({ currentContent: event.target.value })}>
          <option>Información para pacientes</option><option>Campaña de vacunación</option><option>Canal institucional</option><option>Menú y horarios</option><option>Turnos de atención</option><option>Sin conexión</option>
        </select>
        <button className="mt-3 flex h-10.5 w-full cursor-pointer items-center justify-center gap-2 rounded-md border-0 bg-[#246bfd] text-white transition hover:bg-[#1659df] disabled:cursor-not-allowed disabled:bg-[#aeb5c0]" disabled={device.status === "offline"} onClick={() => onChange({ status: "playing" })}>
          <Send size={17} /> Enviar a pantalla
        </button>
      </div>
    </aside>
  );
}

function ActionButton({ icon, label, onClick }: { icon: React.ReactNode; label: string; onClick: () => void }) {
  return (
    <button className="flex h-10.5 cursor-pointer items-center justify-center gap-2 rounded-md border border-[#e4e5e7] bg-white px-2 text-base transition hover:bg-[#f5f7fa]" onClick={onClick}>
      {icon}<span className="hidden sm:inline">{label}</span>
    </button>
  );
}
