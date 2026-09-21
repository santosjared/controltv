"use client";

import Image from "next/image";
import { useEffect, useMemo, useState, type DragEvent } from "react";
import {
  Bell,
  AlertTriangle,
  BarChart3,
  CalendarDays,
  Check,
  ChevronRight,
  CircleStop,
  EyeOff,
  FileVideo,
  History,
  ImageIcon,
  Home,
  LoaderCircle,
  Maximize2,
  Minimize2,
  MoreVertical,
  Monitor,
  MonitorOff,
  MonitorPlay,
  Pause,
  Pencil,
  Play,
  Repeat2,
  Radio,
  Search,
  Send,
  Trash2,
  UploadCloud,
  Volume2,
  VolumeX,
  X,
  Tv2,
} from "lucide-react";
import type { Television, TelevisionConnectionStatus, TelevisionStatus } from "../types";
import { useDeleteTelevisionMutation, useGetTelevisionsQuery, useRegisterConnectedTvMutation, useUpdateTelevisionMutation } from "../api/televisions-api";
import { useConnectedTvs, type AdminCommandEvent, type MediaErrorState, type MediaReadyState } from "../hooks/use-connected-tvs";
import { useMediaTransfer } from "../hooks/use-media-transfer";
import { MEDIA_FILE_ACCEPT } from "../utils/media-file";

const statusStyles: Record<TelevisionStatus, string> = {
  playing: "bg-[#246bfd]",
  available: "bg-[#20ad78]",
  offline: "bg-[#d74747]",
};

const connectionLabels: Record<TelevisionConnectionStatus, string> = {
  online: "En línea",
  "low-signal": "Señal baja",
  offline: "Sin conexión",
};

const connectionStyles: Record<TelevisionConnectionStatus, string> = {
  online: "bg-[#20ad78]",
  "low-signal": "bg-[#e1a12d]",
  offline: "bg-[#d74747]",
};

const connectionChipStyles: Record<TelevisionConnectionStatus, string> = {
  online: "bg-[#dff5e9] text-[#18744f]",
  "low-signal": "bg-[#fff1cc] text-[#8a6210]",
  offline: "bg-[#ffe5e6] text-[#b92f38]",
};

const connectionDotStyles: Record<TelevisionConnectionStatus, string> = {
  online: "bg-[#20ad78]",
  "low-signal": "bg-[#e1a12d]",
  offline: "bg-[#d74747]",
};

type PendingMediaTransfer = {
  tvId: string;
  fileName: string;
  kind: "IMAGE" | "VIDEO";
  readyBaseline: number;
  errorBaseline: number;
};

const emptyTelevisions: Television[] = [];

function formatPlaybackTime(seconds = 0) {
  const safeSeconds = Math.max(0, Math.floor(seconds));
  const minutes = Math.floor(safeSeconds / 60).toString().padStart(2, "0");
  const remainingSeconds = (safeSeconds % 60).toString().padStart(2, "0");
  return `${minutes}:${remainingSeconds}`;
}

function playbackActivityLabel(device: Television) {
  if (device.connectionStatus === "offline" || device.status === "offline") return "Sin conexión";
  if (device.playbackState === "paused") return "Reproducción pausada";
  if (device.playbackState === "stopped") return "Reproducción detenida";
  if (device.playbackState !== "playing") return "Contenido listo";

  const contactDate = device.lastContactAt ? new Date(device.lastContactAt) : null;
  const hasValidDate = contactDate && !Number.isNaN(contactDate.getTime());
  const time = hasValidDate
    ? new Intl.DateTimeFormat("es-BO", { hour: "2-digit", minute: "2-digit", hour12: false }).format(contactDate)
    : null;
  return device.contentType === "IMAGE"
    ? time ? `Mostrando desde las ${time}` : "Mostrando en pantalla"
    : time ? `Reproduciendo desde las ${time}` : "Reproduciendo ahora";
}

function playbackActivityColor(device: Television) {
  if (device.connectionStatus === "offline" || device.status === "offline") return "bg-[#d74747]";
  if (device.playbackState === "stopped" || device.playbackState === "paused") return "bg-[#e1a12d]";
  return "bg-[#20ad78]";
}

export function ControlTvDashboard() {
  const { data = emptyTelevisions, isLoading, isFetching, error, refetch } = useGetTelevisionsQuery(undefined, { refetchOnFocus: true, refetchOnReconnect: true });
  const { socketDevices, onlineTvIds, lowSignalTvIds, hasStatusSnapshot, mediaReadyByTvId, mediaErrorByTvId, latestMediaError, dismissMediaError, mediaControlByTvId, sendAdminCommand } = useConnectedTvs();
  // Estado optimista local; las confirmaciones posteriores de la TV tienen prioridad.
  const [overrides, setOverrides] = useState<Record<string, Partial<Television>>>({});
  const sourceDevices = error ? emptyTelevisions : data;
  const devices = useMemo(() => {
    const onlineIds = new Set(onlineTvIds);
    const lowSignalIds = new Set(lowSignalTvIds);

    return sourceDevices.map((device) => {
      const localDevice = { ...device, ...overrides[device.id] };
      const tvCode = device.tvCode ?? device.id;
      const mediaControl = mediaControlByTvId[tvCode];
      const isLowSignal = hasStatusSnapshot && lowSignalIds.has(tvCode);
      const isOnline = hasStatusSnapshot && onlineIds.has(tvCode);
      const synchronizedDevice = {
        ...localDevice,
        ...(mediaControl?.status ? { status: mediaControl.status } : {}),
        ...(mediaControl?.playbackState ? { playbackState: mediaControl.playbackState } : {}),
        ...(mediaControl?.volume !== undefined ? { volume: mediaControl.volume } : {}),
        ...(mediaControl?.repeat !== undefined ? { repeat: mediaControl.repeat } : {}),
      };

      if (!isOnline) return { ...synchronizedDevice, status: "offline" as const, connectionStatus: "offline" as const };
      return {
        ...synchronizedDevice,
        status: synchronizedDevice.status === "offline" ? "available" as const : synchronizedDevice.status,
        connectionStatus: isLowSignal ? "low-signal" as const : "online" as const,
      };
    });
  }, [sourceDevices, overrides, onlineTvIds, lowSignalTvIds, hasStatusSnapshot, mediaControlByTvId]);
  const [registeredPendingIds, setRegisteredPendingIds] = useState<string[]>([]);
  const pendingDevices = (socketDevices ?? emptyTelevisions).filter((device) => !registeredPendingIds.includes(device.id));
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [deviceToRegister, setDeviceToRegister] = useState<Television | null>(null);
  const [deviceToEdit, setDeviceToEdit] = useState<Television | null>(null);
  const [deviceToDelete, setDeviceToDelete] = useState<Television | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [pendingMediaByDeviceId, setPendingMediaByDeviceId] = useState<Record<string, PendingMediaTransfer>>({});
  const [completedTvCodes, setCompletedTvCodes] = useState<string[]>([]);
  const [query, setQuery] = useState("");
  const selected = devices.find((device) => device.id === selectedId) ?? devices[0];
  const visibleDevices = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase("es");
    return normalized
      ? devices.filter((device) => `${device.room} ${device.name} ${device.tvCode ?? ""} ${device.location ?? ""}`.toLocaleLowerCase("es").includes(normalized))
      : devices;
  }, [devices, query]);

  useEffect(() => {
    const completed = Object.entries(pendingMediaByDeviceId).filter(([, pending]) => (mediaReadyByTvId[pending.tvId]?.sequence ?? 0) > pending.readyBaseline);
    const failed = Object.entries(pendingMediaByDeviceId).filter(([, pending]) => (mediaErrorByTvId[pending.tvId]?.sequence ?? 0) > pending.errorBaseline);
    if (completed.length === 0 && failed.length === 0) return;
    let cancelled = false;
    queueMicrotask(() => {
      if (cancelled) return;
      setOverrides((current) => {
        const next = { ...current };
        for (const [deviceId, pending] of completed) {
          const readyContent = mediaReadyByTvId[pending.tvId]?.content;
          const contentId = typeof readyContent?.id === "string" ? readyContent.id : undefined;
          next[deviceId] = { ...next[deviceId], currentContent: pending.fileName, contentType: pending.kind, ...(contentId ? { currentContentId: contentId } : {}) };
        }
        return next;
      });
      setPendingMediaByDeviceId((current) => {
        const next = { ...current };
        for (const [deviceId] of completed) delete next[deviceId];
        for (const [deviceId] of failed) delete next[deviceId];
        return next;
      });
      setCompletedTvCodes((current) => [...current, ...completed.map(([, pending]) => pending.tvId)]);
    });
    return () => { cancelled = true; };
  }, [mediaReadyByTvId, mediaErrorByTvId, pendingMediaByDeviceId]);

  useEffect(() => {
    if (completedTvCodes.length === 0) return;
    const timer = window.setTimeout(() => setCompletedTvCodes((current) => current.slice(1)), 4200);
    return () => window.clearTimeout(timer);
  }, [completedTvCodes]);

  const updateSelected = (changes: Partial<Television>) => {
    if (!selected) return;
    setOverrides((current) => ({ ...current, [selected.id]: { ...current[selected.id], ...changes } }));
  };

  const updateDevice = (deviceId: string, changes: Partial<Television>) => {
    setOverrides((current) => ({ ...current, [deviceId]: { ...current[deviceId], ...changes } }));
  };

  const assignMedia = (deviceId: string, file: File, kind: "IMAGE" | "VIDEO", contentId?: string) => {
    setOverrides((current) => ({ ...current, [deviceId]: { ...current[deviceId], currentContent: file.name, contentType: kind, ...(contentId ? { currentContentId: contentId } : {}) } }));
    setSelectedId(deviceId);
  };

  const online = devices.filter((device) => device.connectionStatus !== "offline").length;
  const lowSignal = devices.filter((device) => device.connectionStatus === "low-signal").length;
  const offline = devices.filter((device) => device.connectionStatus === "offline").length;

  return (
    <main className="min-h-screen bg-[#f2f2f2] text-[#202226]">
      <header id="inicio" className="flex min-h-20 items-center justify-between gap-6 bg-[linear-gradient(110deg,#0d7558_0%,#356f3d_46%,#e5393f_100%)] px-5 py-4 text-white shadow-[0_8px_24px_rgba(45,72,61,0.22)] md:px-9">
        <div className="flex items-center gap-4.5">
          <span className="grid size-14 place-items-center">
            <Tv2 aria-hidden="true" size={50} strokeWidth={1.8} />
          </span>
          <span>
            <strong className="block text-[22px] leading-tight tracking-[-0.6px] md:text-[28px]">Control TV</strong>
            <small className="mt-1 block text-[13px] text-[#d6ece6] md:text-base"><span className="font-bold text-red-800">Hospital</span> Daniel Bracamente</small>
          </span>
        </div>
        <nav className="hidden items-center gap-1 xl:flex" aria-label="Navegación principal">
          <a href="#inicio" className="flex items-center gap-2 rounded-xl bg-white/90 px-4 py-2.5 font-semibold text-[#202226]"><Home size={17} /> Inicio</a>
          <a href="#televisores" className="flex items-center gap-2 rounded-xl px-4 py-2.5 text-white/90 transition hover:bg-white/15"><Monitor size={17} /> Televisores</a>
          <a href="#transmision-general" className="flex items-center gap-2 rounded-xl px-4 py-2.5 text-white/90 transition hover:bg-white/15"><Radio size={17} /> Contenido</a>
          <a href="#resumen" className="flex items-center gap-2 rounded-xl px-4 py-2.5 text-white/90 transition hover:bg-white/15"><BarChart3 size={17} /> Reportes</a>
        </nav>
        <div className="relative flex items-center gap-2.5">
          {offline > 0 && <span className="hidden rounded-xl border border-white/35 bg-[#d9363e]/80 px-4 py-2 text-sm font-semibold shadow-sm lg:block">{offline} {offline === 1 ? "televisor" : "televisores"} sin conexión</span>}
          <button type="button" onClick={() => setNotificationsOpen((open) => !open)} className="relative grid size-11 cursor-pointer place-items-center rounded-xl border border-white/25 bg-black/15 text-white shadow-[0_6px_16px_rgba(0,0,0,0.14)] transition hover:bg-black/25" aria-expanded={notificationsOpen} aria-label={`${pendingDevices.length} dispositivos pendientes de registro`}>
            <Bell size={19} />{pendingDevices.length > 0 && <i className="absolute -right-1.5 -top-1.5 grid size-5 place-items-center rounded-full bg-[#f5b942] text-[11px] font-bold not-italic text-[#4b3410] ring-2 ring-white">{pendingDevices.length}</i>}
          </button>
          <span className="hidden size-11 place-items-center rounded-full bg-white/90 text-sm font-bold text-[#27634f] sm:grid">CM</span>
          {notificationsOpen &&
            <div className="absolute right-0 top-15 z-30 w-[min(360px,calc(100vw-32px))] overflow-hidden rounded-2xl border border-[#e5e7e6] bg-white text-[#202226] shadow-[0_20px_50px_rgba(0,0,0,0.22)]">
              <div className="border-b border-[#e8e9e9] px-4 py-3">
                <strong className="block">{pendingDevices.length} Dispositivos detectados</strong>
                <small className="text-[#868890]">Selecciona uno para registrarlo</small>
              </div>
              <div className="max-h-80 overflow-y-auto p-2">
                {pendingDevices.map((device) =>
                  <button key={device.id} type="button" onClick={() => { setDeviceToRegister(device); setNotificationsOpen(false); }} className="flex w-full cursor-pointer items-center gap-3 rounded-xl border-0 bg-transparent p-3 text-left transition hover:bg-[#f1f6f4]">
                    <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-[#e2f0ec] text-[#236b5b]">
                      <Monitor size={20} />
                    </span>
                    <dl className="min-w-0 grid grid-cols-[100px_minmax(0,1fr)] text-xs">
                      <dt className="text-[#778083]">ID del TV</dt><dd className="truncate font-medium">{device.id}</dd>
                      <dt className="text-[#778083]">IP</dt><dd className="truncate">{device.ip}</dd>
                      <dt className="text-[#778083]">Modelo</dt><dd className="truncate">{device.model}</dd>
                      <dt className="text-[#778083]">Android</dt><dd>{device.androidVersion}</dd>

                    </dl>
                    <ChevronRight size={18} className="text-[#8a8d8c]" />
                  </button>)}{pendingDevices.length === 0 && <p className="px-3 py-6 text-center text-sm text-[#68696d]">No hay dispositivos pendientes.</p>}
              </div>
            </div>}
        </div>
      </header>

      <section id="resumen" className="grid grid-cols-1 gap-3.5 px-5 py-5 sm:grid-cols-2 xl:grid-cols-[repeat(4,minmax(0,1fr))_250px] md:px-9 md:py-6" aria-label="Resumen de dispositivos">
        <Metric label="Televisores" value={devices.length} detail="Dispositivos registrados" iconColor="bg-[#438b7a]" borderColor="border-l-[#438b7a]" />
        <Metric label="En línea" value={online} detail="Listos para transmitir" iconColor="bg-[#20ad78]" borderColor="border-l-[#20ad78]" />
        <Metric label="Sin Conexión" value={offline} detail="Dispositivos sin conexión" iconColor="bg-[#d74747]" borderColor="border-l-[#d74747]" />
        <Metric label="Con problemas" value={lowSignal} detail="Requieren revisión" iconColor="bg-[#e1a12d]" borderColor="border-l-[#e1a12d]" />
        <CurrentTime />
      </section>

      <div id="televisores" className="grid items-start gap-5 px-5 pb-24 xl:grid-cols-[minmax(0,1fr)_380px] xl:px-9">
        <div className="min-w-0 space-y-5">
          <GlobalBroadcast
            devices={devices}
            selectedIds={selectedIds}
            mediaReadyByTvId={mediaReadyByTvId}
            mediaErrorByTvId={mediaErrorByTvId}
            onMediaAssigned={(targetDevices, file, kind, readyBaselines, errorBaselines) => {
              setPendingMediaByDeviceId((current) => {
                const next = { ...current };
                for (const device of targetDevices) {
                  const tvId = device.tvCode ?? device.id;
                  next[device.id] = { tvId, fileName: file.name, kind, readyBaseline: readyBaselines[tvId] ?? 0, errorBaseline: errorBaselines[tvId] ?? 0 };
                }
                return next;
              });
            }}
          />
          <section className="min-w-0 rounded-2xl border border-[#e2e6e4] bg-white p-4 shadow-[0_10px_30px_rgba(25,45,38,0.06)] md:p-5">
            <div className="mb-6 flex flex-col gap-4 border-b border-[#d8dddb] pb-5 md:flex-row md:items-center md:justify-between">
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
            <div className="grid max-h-155 grid-cols-1 gap-5 overflow-y-auto pb-4 md:grid-cols-2 2xl:grid-cols-3">
              {visibleDevices.map((device) => (
                <DeviceCard key={device.id} device={device} pendingMedia={pendingMediaByDeviceId[device.id]} mediaReady={mediaReadyByTvId[device.tvCode ?? device.id]} mediaError={mediaErrorByTvId[device.tvCode ?? device.id]} selected={device.id === selected?.id} checked={selectedIds.includes(device.id)} onToggleChecked={() => setSelectedIds((current) => current.includes(device.id) ? current.filter((id) => id !== device.id) : [...current, device.id])} onCommand={sendAdminCommand} onChange={(changes) => updateDevice(device.id, changes)} onEdit={() => setDeviceToEdit(device)} onDelete={() => setDeviceToDelete(device)} onSelect={() => setSelectedId(device.id)} onMediaDrop={(file, kind, contentId) => assignMedia(device.id, file, kind, contentId)} />
              ))}
              {isLoading && <p role="status">Cargando televisores registrados…</p>}
              {error && <div role="alert"><p>No se pudieron cargar los televisores registrados.</p><button className="mt-3 rounded bg-[#236b5b] px-4 py-2 text-white" disabled={isFetching} onClick={() => refetch()}>Reintentar</button></div>}
              {!isLoading && !error && visibleDevices.length === 0 && <p className="text-[#666970]">{devices.length === 0 ? "No hay televisores registrados." : "No encontramos salas con ese nombre."}</p>}
            </div>
          </section>
        </div>
        {selected ? <div><ControlPanel key={selected.id} device={selected} isMediaPending={Boolean(pendingMediaByDeviceId[selected.id])} mediaReady={mediaReadyByTvId[selected.tvCode ?? selected.id]} mediaError={mediaErrorByTvId[selected.tvCode ?? selected.id]} onCommand={sendAdminCommand} onChange={updateSelected} /></div> : <aside className="rounded-2xl bg-white p-7 text-[#666970]">Selecciona un televisor para ver su panel de control.</aside>}
      </div>
      {deviceToRegister && <RegisterDeviceDialog device={deviceToRegister} onCancel={() => setDeviceToRegister(null)} onRegistered={() => { setRegisteredPendingIds((current) => [...current, deviceToRegister.id]); setDeviceToRegister(null); }} />}
      {deviceToEdit && <EditDeviceDialog device={deviceToEdit} onClose={() => setDeviceToEdit(null)} />}
      {deviceToDelete && <DeleteDeviceDialog device={deviceToDelete} onClose={() => setDeviceToDelete(null)} onDeleted={() => { setDeviceToDelete(null); setSelectedIds((current) => current.filter((id) => id !== deviceToDelete.id)); if (selectedId === deviceToDelete.id) setSelectedId(null); }} />}
      {latestMediaError && <MediaErrorDialog error={latestMediaError} onClose={dismissMediaError} />}
      {completedTvCodes[0] && <div className="pointer-events-none fixed inset-x-4 bottom-6 z-80 flex justify-center"><div role="status" aria-live="polite" className="tv-snackbar flex w-full max-w-md items-center gap-3 rounded-xl bg-[#173f35] px-4 py-3 text-white shadow-[0_14px_40px_rgba(10,45,33,0.32)]"><span className="grid size-9 shrink-0 place-items-center rounded-full bg-[#20ad78] text-white"><Check size={19} /></span><span className="min-w-0"><strong className="block text-sm">TV lista para reproducir</strong><small className="block truncate text-white/80">{completedTvCodes[0]} terminó de descargar el contenido.</small></span></div></div>}
    </main>
  );
}

function MediaErrorDialog({ error, onClose }: { error: MediaErrorState; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/55 p-4" role="presentation" onMouseDown={(event) => { if (event.currentTarget === event.target) onClose(); }}>
      <section role="alertdialog" aria-modal="true" aria-labelledby="media-error-title" className="w-full max-w-md rounded-2xl bg-white p-6 text-[#202226] shadow-[0_24px_70px_rgba(0,0,0,0.32)]">
        <div className="flex items-start justify-between gap-4">
          <span className="grid size-12 shrink-0 place-items-center rounded-xl bg-[#fff0f0] text-[#d74747]"><AlertTriangle size={25} /></span>
          <button type="button" onClick={onClose} aria-label="Cerrar mensaje de error" className="grid size-9 cursor-pointer place-items-center rounded-lg border-0 bg-[#f2f2f2] text-[#555] hover:bg-[#e7e7e7]"><X size={19} /></button>
        </div>
        <h2 id="media-error-title" className="mt-5 text-xl font-semibold">No se pudo preparar el contenido</h2>
        <p className="mt-2 text-[#626468]">{error.message}</p>
        <dl className="mt-5 grid gap-2 rounded-xl bg-[#f6f7f7] p-4 text-sm">
          <div className="flex justify-between gap-4"><dt className="text-[#737579]">Televisor</dt><dd className="font-semibold">{error.tvId}</dd></div>
          <div className="flex justify-between gap-4"><dt className="text-[#737579]">Código</dt><dd className="font-mono font-semibold text-[#b4232c]">{error.code}</dd></div>
        </dl>
        <button type="button" onClick={onClose} className="mt-6 h-11 w-full cursor-pointer rounded-xl border-0 bg-[#236b5b] font-semibold text-white hover:bg-[#1d5b4e]">Entendido</button>
      </section>
    </div>
  );
}

function EditDeviceDialog({ device, onClose }: { device: Television; onClose: () => void }) {
  const [nombre, setNombre] = useState(device.name);
  const [sala, setSala] = useState(device.room);
  const [ubicacion, setUbicacion] = useState(device.location ?? "");
  const [updateTelevision, { isLoading, error }] = useUpdateTelevisionMutation();

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!device.tvCode || !device.roomId) return;
    try {
      await updateTelevision({
        id: device.id,
        tv_id: device.tvCode,
        nombre: nombre.trim(),
        sala_id: device.roomId,
        sala: sala.trim(),
        ubicacion: ubicacion.trim(),
      }).unwrap();
      onClose();
    } catch {
      // RTK Query muestra el error dentro del diálogo.
    }
  };

  return (
    <div className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-black/60 p-4 backdrop-blur-[2px]" role="presentation" onMouseDown={(event) => { if (event.currentTarget === event.target) onClose(); }}>
      <section role="dialog" aria-modal="true" aria-labelledby="edit-tv-title" className="my-auto w-full max-w-xl overflow-hidden rounded-3xl bg-white text-[#202226] shadow-[0_28px_80px_rgba(0,0,0,0.35)]">
        <div className="flex items-center justify-between border-b border-[#e7e9e8] px-6 py-5">
          <div>
            <span className="text-xl font-bold">EDITAR DISPOSITIVO</span>
            <h2 id="edit-tv-title" className="mt-1 text-sm text-[#898b94]">Actualizar información del televisor</h2>
          </div>
          <button type="button" onClick={onClose} className="grid size-9 cursor-pointer place-items-center rounded-full border-0 bg-[#f1f3f2] text-xl" aria-label="Cerrar">×</button>
        </div>

        <form onSubmit={submit} className="px-6 py-6">
          <div className="mb-6 rounded-r-2xl border-l-3 border-[#146be8] bg-[#f2f7ff] py-3 pl-5 pr-4">
            <div className="flex items-center gap-2">
              <Monitor size={19} className="text-[#146be8]" />
              <h3 className="font-semibold">Detalles del dispositivo</h3>
            </div>
            <dl className="mt-3 grid grid-cols-[105px_minmax(0,1fr)] gap-y-1.5 text-sm">
              <dt className="text-[#778083]">Modelo</dt><dd className="truncate font-medium text-[#25292b]">{device.model ?? "No registrado"}</dd>
              <dt className="text-[#778083]">Dirección IP</dt><dd className="truncate">{device.ip}</dd>
              <dt className="text-[#778083]">Android</dt><dd>{device.androidVersion ?? "No registrado"}</dd>
              <dt className="text-[#778083]">ID del TV</dt><dd className="truncate">{device.tvCode ?? device.id}</dd>
            </dl>
          </div>

          <div className="space-y-4">
            <FormField label="Nombre del televisor" placeholder="TV Emergencias" value={nombre} onChange={setNombre} maxLength={100} />
            <FormField label="Nombre de la sala" placeholder="Emergencias" value={sala} onChange={setSala} maxLength={100} />
            <FormField label="Ubicación" placeholder="Planta baja" value={ubicacion} onChange={setUbicacion} maxLength={200} />
          </div>
          {(!device.tvCode || !device.roomId) && <p role="alert" className="mt-4 rounded-lg bg-[#fff8e6] px-3 py-2 text-sm text-[#76520d]">No se puede actualizar porque faltan el tv_id o el sala_id del dispositivo.</p>}
          {error && <p role="alert" className="mt-4 rounded-lg bg-[#fff0f0] px-3 py-2 text-sm text-[#b4232c]">No se pudieron guardar los cambios. Inténtalo nuevamente.</p>}
          <div className="mt-7 flex justify-end gap-3"><button type="button" onClick={onClose} className="h-11 cursor-pointer rounded-xl border border-[#d8dcda] bg-white px-5 font-medium">Cancelar</button><button type="submit" disabled={isLoading || !device.tvCode || !device.roomId || !nombre.trim() || !sala.trim() || !ubicacion.trim()} style={{ color: "#ffffff" }} className="h-11 cursor-pointer rounded-xl border-0 bg-[#146be8] px-6 font-semibold transition hover:bg-[#0e5bc9] disabled:cursor-not-allowed disabled:opacity-50">{isLoading ? "Guardando…" : "Guardar cambios"}</button></div>
        </form>
      </section>
    </div>
  );
}

function DeleteDeviceDialog({ device, onClose, onDeleted }: { device: Television; onClose: () => void; onDeleted: () => void }) {
  const [deleteTelevision, { isLoading, error }] = useDeleteTelevisionMutation();
  const remove = async () => {
    try {
      await deleteTelevision(device.id).unwrap();
      onDeleted();
    } catch {
      // RTK Query muestra el error dentro del diálogo.
    }
  };

  return (
    <div className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-black/60 p-4 backdrop-blur-[2px]" role="presentation" onMouseDown={(event) => { if (event.currentTarget === event.target) onClose(); }}>
      <section role="alertdialog" aria-modal="true" aria-labelledby="delete-tv-title" className="my-auto w-full max-w-xl overflow-hidden rounded-3xl bg-white text-[#202226] shadow-[0_28px_80px_rgba(0,0,0,0.35)]">
        <div className="flex items-center justify-between border-b border-[#e7e9e8] px-6 py-5">
          <div>
            <span className="text-xl font-bold">ELIMINAR DISPOSITIVO</span>
            <h2 id="delete-tv-title" className="mt-1 text-sm text-[#898b94]">Confirmar eliminación del televisor</h2>
          </div>
          <button type="button" onClick={onClose} className="grid size-9 cursor-pointer place-items-center rounded-full border-0 bg-[#f1f3f2] text-xl" aria-label="Cerrar">×</button>
        </div>

        <div className="px-6 py-6">
          <div className="mb-6 rounded-r-2xl border-l-3 border-[#d74747] bg-[#fff5f5] py-3 pl-5 pr-4">
            <div className="flex items-center gap-2">
              <Trash2 size={19} className="text-[#c9363e]" />
              <h3 className="font-semibold">Detalles del dispositivo</h3>
            </div>
            <dl className="mt-3 grid grid-cols-[105px_minmax(0,1fr)] gap-y-1.5 text-sm">
              <dt className="text-[#778083]">Nombre</dt><dd className="truncate font-medium text-[#25292b]">{device.name}</dd>
              <dt className="text-[#778083]">Sala</dt><dd className="truncate">{device.room}</dd>
              <dt className="text-[#778083]">Ubicación</dt><dd className="truncate">{device.location ?? "No registrada"}</dd>
              <dt className="text-[#778083]">Dirección IP</dt><dd className="truncate">{device.ip}</dd>
              <dt className="text-[#778083]">ID del TV</dt><dd className="truncate">{device.tvCode ?? device.id}</dd>
            </dl>
          </div>

          <div className="flex items-start gap-3 rounded-xl border border-[#f2d1d3] bg-[#fff7f7] px-4 py-3 text-sm text-[#793237]"><AlertTriangle size={20} className="mt-0.5 shrink-0 text-[#d74747]" /><p><strong className="block text-[#a52f36]">Esta acción no se puede deshacer</strong>El televisor se quitará del panel administrativo y deberá registrarse nuevamente para volver a utilizarlo.</p></div>
          {error && <p role="alert" className="mt-4 rounded-lg bg-[#fff0f0] px-3 py-2 text-sm text-[#b4232c]">No se pudo eliminar el televisor. Inténtalo nuevamente.</p>}
          <div className="mt-7 flex justify-end gap-3"><button type="button" onClick={onClose} className="h-11 cursor-pointer rounded-xl border border-[#d8dcda] bg-white px-5 font-medium">Cancelar</button><button type="button" disabled={isLoading} onClick={() => void remove()} style={{ color: "#ffffff" }} className="flex h-11 cursor-pointer items-center gap-2 rounded-xl border-0 bg-[#d74747] px-6 font-semibold transition hover:bg-[#bd333a] disabled:cursor-not-allowed disabled:opacity-50"><Trash2 size={17} />{isLoading ? "Eliminando…" : "Eliminar dispositivo"}</button></div>
        </div>
      </section>
    </div>
  );
}

function RegisterDeviceDialog({ device, onCancel, onRegistered }: { device: Television; onCancel: () => void; onRegistered: () => void }) {
  const [nombre, setNombre] = useState("");
  const [sala, setSala] = useState("");
  const [ubicacion, setUbicacion] = useState("");
  const [registerDevice, { isLoading, error }] = useRegisterConnectedTvMutation();
  const hasValidTvId = /^TV-[0-9A-F]{8}-[0-9A-F]{3}$/.test(device.id);
  const hasDeviceMetadata = Boolean((device.model ?? device.room).trim() && device.androidVersion?.trim() && device.ip.trim());
  const canRegister = hasValidTvId && hasDeviceMetadata && Boolean(nombre.trim() && sala.trim() && ubicacion.trim());

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    try {
      await registerDevice({
        tv_id: device.id,
        model: device.model ?? device.room,
        version_android: device.androidVersion ?? "",
        ip: device.ip,
        nombre: nombre.trim(),
        sala: sala.trim(),
        ubicacion: ubicacion.trim(),
      }).unwrap();
      onRegistered();
    } catch {
      // RTK Query expone el error debajo del formulario.
    }
  };

  return (
    <div className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-black/60 p-4 backdrop-blur-[2px]" role="presentation">
      <section role="dialog" aria-modal="true" aria-labelledby="register-device-title" className="my-auto w-full max-w-xl overflow-hidden rounded-3xl bg-white text-[#202226] shadow-[0_28px_80px_rgba(0,0,0,0.35)]">
        <div className="flex items-center justify-between border-b border-[#e7e9e8] px-6 py-5">
          <div>
            <span className="text-xl font-bold">NUEVO DISPOSITIVO</span>
            <h2 id="register-device-title" className="mt-1 text-sm text-[#898b94]">Registrar televisor</h2>
          </div>
          <button type="button" onClick={onCancel} className="grid size-9 cursor-pointer place-items-center rounded-full border-0 bg-[#f1f3f2] text-xl" aria-label="Cerrar">×</button>
        </div>
        <form onSubmit={submit} className="px-6 py-6">
          <div className="mb-6 rounded-r-2xl border-l-3 border-[#146be8] bg-[#f2f7ff] py-3 pl-5 pr-4">
            <div className="flex items-center gap-2">
              <Monitor size={19} className="text-[#146be8]" />
              <h3 className="font-semibold">Detalles del dispositivo</h3>
            </div>
            <dl className="mt-2 grid grid-cols-[105px_minmax(0,1fr)] text-sm">
              <dt className="text-[#778083]">Modelo</dt><dd className="truncate font-medium text-[#25292b]">{device.model}</dd>
              <dt className="text-[#778083]">IP</dt><dd className="truncate">{device.ip}</dd>
              <dt className="text-[#778083]">Android</dt><dd>{device.androidVersion}</dd>
              <dt className="text-[#778083]">ID del TV</dt><dd className="truncate">{device.id}</dd>
            </dl>
          </div>
          <div className="space-y-4">
            <FormField label="Nombre del televisor" placeholder="TV Emergencias" value={nombre} onChange={setNombre} maxLength={100} />
            <FormField label="Nombre de la sala" placeholder="Emergencias" value={sala} onChange={setSala} maxLength={100} />
            <FormField label="Ubicación" placeholder="Piso 1" value={ubicacion} onChange={setUbicacion} maxLength={200} />
          </div>
          {(!hasValidTvId || !hasDeviceMetadata) && <p role="alert" className="mt-4 rounded-lg bg-[#fff8e6] px-3 py-2 text-sm text-[#76520d]">El dispositivo no cumple el contrato de registro: verifica tv_id, modelo, versión de Android e IP.</p>}
          {error && <p role="alert" className="mt-4 rounded-lg bg-[#fff0f0] px-3 py-2 text-sm text-[#b4232c]">No se pudo registrar. Revisa los datos e inténtalo nuevamente.</p>}
          <div className="mt-7 flex justify-end gap-3"><button type="button" onClick={onCancel} className="h-11 cursor-pointer rounded-xl border border-[#d8dcda] bg-white px-5 font-medium">Cancelar</button><button type="submit" disabled={isLoading || !canRegister} style={{ color: "#ffffff" }} className="h-11 cursor-pointer rounded-xl border-0 bg-[#146be8] px-6 font-semibold transition hover:bg-[#0e5bc9] disabled:cursor-not-allowed disabled:opacity-50">{isLoading ? "Registrando…" : "Registrar"}</button></div>
        </form>
      </section>
    </div>
  );
}

function FormField({ label, placeholder, value, onChange, maxLength }: { label: string; placeholder: string; value: string; onChange: (value: string) => void; maxLength: number }) {
  return <label className="block"><span className="mb-1.5 block text-sm font-semibold">{label}</span><input required value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} maxLength={maxLength} className="h-12 w-full rounded-xl border border-[#d8dcda] bg-white px-4 outline-none transition focus:border-[#146be8] focus:ring-3 focus:ring-[#146be8]/12" /></label>;
}

function CurrentTime() {
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    const update = () => setNow(new Date());
    update();
    const timer = window.setInterval(update, 1000);
    return () => window.clearInterval(timer);
  }, []);

  return (
    <article className="flex h-28 items-center gap-4 border-l border-[#d9dfdc] bg-transparent px-5 xl:ml-2">
      <CalendarDays size={25} className="shrink-0 text-blue-700" />
      <span className="min-w-0"><small className="block truncate text-[#6f7477]">{now ? new Intl.DateTimeFormat("es-BO", { weekday: "long", day: "numeric", month: "long", year: "numeric" }).format(now) : "Fecha actual"}</small><strong className="block text-2xl leading-7">{now ? new Intl.DateTimeFormat("es-BO", { hour: "2-digit", minute: "2-digit" }).format(now) : "--:--"}</strong>
        <small className="text-[#7b8082]"><span className="text-red-700">Hospital</span> <span className="text-green-600">Daniel Bracamonte</span></small></span>
    </article>
  );
}

function GlobalBroadcast({ devices, selectedIds, mediaReadyByTvId, mediaErrorByTvId, onMediaAssigned }: { devices: Television[]; selectedIds: string[]; mediaReadyByTvId: Record<string, MediaReadyState>; mediaErrorByTvId: Record<string, MediaErrorState>; onMediaAssigned: (devices: Television[], file: File, kind: "IMAGE" | "VIDEO", readyBaselines: Record<string, number>, errorBaselines: Record<string, number>) => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewExpanded, setPreviewExpanded] = useState(false);
  const [confirmation, setConfirmation] = useState<{ target: "all" | "selected"; devices: Television[] } | null>(null);
  const [completed, setCompleted] = useState(0);
  const [activeTargetCount, setActiveTargetCount] = useState(0);
  const { transferToMany, resetTransfer, progress, isUploading, error } = useMediaTransfer();
  const onlineDevices = devices.filter((device) => device.connectionStatus !== "offline");
  const selectedDevices = onlineDevices.filter((device) => selectedIds.includes(device.id));
  const extension = file?.name.split(".").pop()?.toUpperCase() ?? "";
  const isVideo = Boolean(file && (file.type.startsWith("video/") || ["MP4", "MOV", "WEBM"].includes(extension)));

  useEffect(() => {
    if (!file) {
      queueMicrotask(() => setPreviewUrl(null));
      return;
    }
    const url = URL.createObjectURL(file);
    queueMicrotask(() => setPreviewUrl(url));
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const broadcast = async (targetDevices: Television[]) => {
    if (!file || targetDevices.length === 0) return;
    setCompleted(0);
    setActiveTargetCount(targetDevices.length);
    const tvIds = targetDevices.map((device) => device.tvCode ?? device.id);
    const readyBaselines = Object.fromEntries(tvIds.map((tvId) => [tvId, mediaReadyByTvId[tvId]?.sequence ?? 0]));
    const errorBaselines = Object.fromEntries(tvIds.map((tvId) => [tvId, mediaErrorByTvId[tvId]?.sequence ?? 0]));
    const kind = await transferToMany(file, tvIds);
    if (!kind) return;
    setCompleted(targetDevices.length);
    onMediaAssigned(targetDevices, file, kind, readyBaselines, errorBaselines);
  };

  const sizeInMb = file ? `${(file.size / 1024 / 1024).toFixed(2)} MB` : "";

  const removeFile = () => {
    setFile(null);
    setPreviewExpanded(false);
    setCompleted(0);
    setActiveTargetCount(0);
    resetTransfer();
  };

  const openConfirmation = (target: "all" | "selected") => {
    setConfirmation({ target, devices: [...(target === "all" ? onlineDevices : selectedDevices)] });
  };

  return (
    <section id="transmision-general" className="rounded-2xl border border-l-4 border-l-blue-700 border-[#dfe5e2] bg-white p-5 shadow-[0_12px_35px_rgba(23,48,39,0.07)] md:p-6">
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <span><h2 className="flex items-center gap-2 text-2xl font-semibold"><Radio className="text-[#179a62]" /> Transmisión general</h2><p className="mt-1 text-[#6b7073]">Envía la misma imagen o video a una o varias pantallas.</p></span>
        <span className="rounded-full bg-[#e9f7f0] px-3 py-1.5 text-sm font-semibold text-[#16734f]">{onlineDevices.length} TV en línea</span>
      </div>

      <div className="grid gap-5 xl:grid-cols-[1fr_1fr_300px]">
        <div>
          <label className="flex min-h-38 cursor-pointer items-center justify-center gap-3 rounded-xl border-2 border-dashed border-[#cdd8d3] bg-[#fafcfb] px-5 text-center transition hover:border-[#179a62] hover:bg-[#f4faf7]">
            <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-[#e6f3ed] text-[#177855]">{file ? (isVideo ? <FileVideo size={23} /> : <ImageIcon size={23} />) : <UploadCloud size={23} />}</span>
            <span className="min-w-0 text-left"><strong className="block truncate">{file?.name ?? "Arrastra una imagen o video aquí"}</strong><small className="mt-1 block text-[#74797b]">MP4, JPG o PNG · Máximo 100 MB</small></span>
            <input type="file" accept={MEDIA_FILE_ACCEPT} className="sr-only" onClick={(event) => { event.currentTarget.value = ""; }} onChange={(event) => setFile(event.target.files?.[0] ?? null)} />
          </label>
          {file ? <div className="relative mt-3 flex items-center gap-3 rounded-xl border-l-4 border-l-purple-800 bg-[#f4f7f6] py-3 pl-3 pr-11">
            <span className={`grid size-10 shrink-0 place-items-center rounded-lg ${isVideo ? "bg-[#eaf2ff] text-[#146be8]" : "bg-[#e7f7ef] text-[#16855d]"}`}>
              {isVideo ? <FileVideo size={21} /> : <ImageIcon size={21} />}
            </span>
            <span className="min-w-0">
              <strong className="block truncate text-sm">{file.name}</strong>
              <small className="mt-1 flex gap-2 text-[#737a7c]">
                <span>{extension}</span><span>·</span><span>{sizeInMb}</span>
              </small>
            </span>
            <button type="button" onClick={removeFile} aria-label={`Quitar ${file.name}`} title="Quitar archivo" className="absolute right-2 top-2 grid size-8 cursor-pointer place-items-center rounded-lg border border-[#dce3df] bg-white text-[#68706d] transition hover:border-[#e34a4f] hover:bg-[#fff1f1] hover:text-[#d7353b]">
              <X size={17} /></button></div> : <div className="mt-3 flex min-h-16 items-center gap-3 rounded-xl border border-dashed border-[#d8dfdc] bg-[#fafcfb] px-3 text-[#7b8280]">
            <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-[#eef2f0]">
              <UploadCloud size={20} /></span><span className="text-sm font-medium">Ningún archivo seleccionado</span>
          </div>}
        </div>

        <div>
          <div className={`${previewExpanded ? "fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-8" : "relative h-52 overflow-hidden rounded-xl bg-[#090c0b]"}`}>
            {previewUrl && file ? (
              isVideo
                ? <video src={previewUrl} controls className={`${previewExpanded ? "max-h-full max-w-full" : "h-full w-full object-contain"}`} />
                : <Image src={previewUrl} alt={`Vista previa de ${file.name}`} fill unoptimized className="object-contain" />
            ) : <span className="flex h-full flex-col items-center justify-center gap-2 text-[#7b8582]"><MonitorPlay size={42} /><small>Vista previa</small></span>}
            {previewUrl && <button type="button" onClick={() => setPreviewExpanded((expanded) => !expanded)} aria-label={previewExpanded ? "Minimizar vista previa" : "Maximizar vista previa"} className="absolute right-3 top-3 grid size-9 cursor-pointer place-items-center rounded-lg border border-white/25 bg-black/55 text-white backdrop-blur-sm">{previewExpanded ? <Minimize2 size={18} /> : <Maximize2 size={18} />}</button>}
          </div>
          {file && <small className="mt-2 block truncate font-bold">Vista previa</small>}
        </div>

        <div>
          <div className="flex min-h-52 flex-col justify-center gap-3 rounded-xl border border-[#e0e5e3] bg-[#fafcfb] p-4">
            <button type="button" disabled={!file || onlineDevices.length === 0 || isUploading} onClick={() => openConfirmation("all")} style={{ color: "#ffffff" }} className="flex min-h-12 cursor-pointer items-center justify-center gap-2 rounded-xl border-0 bg-[#0877ed] px-4 text-sm font-semibold transition-colors hover:bg-[#0069db] disabled:cursor-not-allowed disabled:bg-[#87b8ee]"><Send size={20} className="shrink-0" /><span className="leading-tight">Enviar a todas las pantallas</span><span className="shrink-0 rounded-full bg-white/20 px-2 py-0.5 text-xs">{onlineDevices.length}</span></button>
            <button type="button" disabled={!file || selectedDevices.length === 0 || isUploading} onClick={() => openConfirmation("selected")} style={{ color: "#146be8" }} className="flex min-h-12 cursor-pointer items-center justify-center gap-2 rounded-xl border border-[#cfe2fb] bg-[#e7f1ff] px-4 text-sm font-semibold transition hover:border-[#b7d4f8] hover:bg-[#d9eaff] disabled:cursor-not-allowed disabled:border-[#dce9f8] disabled:bg-[#edf5ff]"><Check size={20} className="shrink-0" /><span className="leading-tight">Enviar a pantallas seleccionadas</span><span className="shrink-0 rounded-full bg-[#d2e5fd] px-2 py-0.5 text-xs">{selectedDevices.length}</span></button>
            {!file && <small className="text-center text-[#7b8183]">Selecciona un archivo para habilitar el envío.</small>}
          </div>
        </div>
      </div>

      {file && progress !== null && <div className="mt-4"><div className="mb-1 flex justify-between text-sm text-[#62686a]"><span>{isUploading ? `Transfiriendo contenido al servidor para ${activeTargetCount} ${activeTargetCount === 1 ? "TV" : "TVs"}…` : `Transferencia al servidor completada · ${completed} ${completed === 1 ? "TV descargando" : "TVs descargando"}`}</span><strong>{progress}%</strong></div><div className="h-2 overflow-hidden rounded-full bg-[#e6ebe9]"><div className="h-full rounded-full bg-[#20ad78] transition-[width]" style={{ width: `${progress}%` }} /></div></div>}
      {error && <p role="alert" className="mt-3 rounded-lg bg-[#fff0f0] px-3 py-2 text-sm text-[#b4232c]">{error}</p>}

      {confirmation && file && <div className="fixed inset-0 z-70 grid place-items-center bg-[#09130f]/55 p-4 backdrop-blur-[2px]" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setConfirmation(null); }}>
        <div role="dialog" aria-modal="true" aria-labelledby="confirm-broadcast-title" className="w-full max-w-lg overflow-hidden rounded-2xl border border-[#dde5e1] bg-white shadow-[0_24px_70px_rgba(8,28,20,0.28)]">
          <div className="flex items-start justify-between gap-4 border-b border-[#e4e9e7] px-6 py-5">
            <span className="flex min-w-0 items-start gap-3"><span className="grid size-11 shrink-0 place-items-center rounded-xl bg-[#e8f2ff] text-[#0877ed]"><Send size={22} /></span><span><h3 id="confirm-broadcast-title" className="text-xl font-semibold text-[#17211d]">{confirmation.target === "all" ? "Enviar a todas las pantallas" : "Enviar a pantallas seleccionadas"}</h3><p className="mt-1 text-sm text-[#69716e]">Revisa la lista y quita las pantallas que no deben recibir el contenido.</p></span></span>
            <button type="button" onClick={() => setConfirmation(null)} aria-label="Cerrar confirmación" className="grid size-9 shrink-0 cursor-pointer place-items-center rounded-lg border border-[#dfe5e2] bg-white text-[#5e6763] hover:bg-[#f2f5f4]"><X size={18} /></button>
          </div>

          <div className="px-6 py-5">
            <div className="flex items-center gap-3 rounded-xl border border-[#cfe2fb] bg-[#f0f6ff] px-4 py-3"><Monitor size={22} className="shrink-0 text-[#0877ed]" /><p className="min-w-0 text-sm text-[#34413c]"><strong className="block text-base text-[#146be8]">{confirmation.devices.length} {confirmation.devices.length === 1 ? "dispositivo destinatario" : "dispositivos destinatarios"}</strong>El archivo <span className="font-semibold">{file.name}</span> se enviará únicamente a esta lista.</p></div>

            <div className="mt-5"><span className="mb-2 block text-sm font-semibold text-[#313a36]">Pantallas que recibirán el contenido</span><ul className="max-h-56 space-y-2 overflow-y-auto pr-1">{confirmation.devices.map((device) => <li key={device.id} className="flex items-center gap-3 rounded-xl border border-[#e2e7e5] px-3.5 py-3"><span className="grid size-9 shrink-0 place-items-center rounded-lg bg-[#e9f7f0] text-[#159667]"><Monitor size={18} /></span><span className="min-w-0 flex-1"><strong className="block truncate text-sm text-[#202925]">{device.name}</strong><small className="block truncate text-[#747c79]">{device.room}{device.location ? ` · ${device.location}` : ""}</small></span><button type="button" onClick={() => setConfirmation((current) => current ? { ...current, devices: current.devices.filter((item) => item.id !== device.id) } : null)} aria-label={`Quitar ${device.name} de este envío`} title="Quitar de este envío" className="grid size-9 shrink-0 cursor-pointer place-items-center rounded-lg border border-[#f0d5d5] bg-[#fff7f7] text-[#c43b42] transition hover:bg-[#ffeaea]"><X size={17} /></button></li>)}{confirmation.devices.length === 0 && <li className="rounded-xl border border-dashed border-[#d7dedb] bg-[#fafcfb] px-4 py-7 text-center text-sm text-[#737b78]">No quedan pantallas en la lista. Agrega una selección nuevamente para continuar.</li>}</ul></div>
          </div>

          <div className="flex justify-end gap-3 border-t border-[#e4e9e7] bg-[#fafcfb] px-6 py-4"><button type="button" onClick={() => setConfirmation(null)} className="h-11 cursor-pointer rounded-xl border border-[#d7dedb] bg-white px-5 font-semibold text-[#46504c] hover:bg-[#f1f4f3]">Cancelar</button><button type="button" disabled={confirmation.devices.length === 0} onClick={() => { const recipients = confirmation.devices; setConfirmation(null); void broadcast(recipients); }} style={{ color: "#ffffff" }} className="flex h-11 cursor-pointer items-center gap-2 rounded-xl border-0 bg-[#0877ed] px-5 font-semibold transition-colors hover:bg-[#0069db] disabled:cursor-not-allowed disabled:bg-[#9abce2]"><Send size={18} />Confirmar envío <span className="rounded-full bg-white/20 px-2 py-0.5 text-xs">{confirmation.devices.length}</span></button></div>
        </div>
      </div>}
    </section>
  );
}

function Metric({ label, value, detail, iconColor, borderColor }: { label: string; value: number; detail: string; iconColor: string; borderColor: string }) {
  return (
    <article className={`flex h-26.25 items-center gap-4 rounded-2xl border border-l-4 border-[#e0e5e3] bg-white px-5 py-4 shadow-[0_8px_24px_rgba(35,70,57,0.06)] md:h-28 md:px-6 ${borderColor}`}>
      <span className={`grid size-12 shrink-0 place-items-center rounded-xl text-white ${iconColor}`}><Monitor size={22} /></span>
      <span className="min-w-0"><strong className="block text-[28px] leading-8 text-[#202226]">{value}</strong><span className="block font-semibold text-[#34383a]">{label}</span><small className="block truncate text-sm text-[#7a7e80]">{detail}</small></span>
    </article>
  );
}

function DeviceCard({ device, pendingMedia, mediaReady, mediaError, selected, checked, onToggleChecked, onCommand, onChange, onEdit, onDelete, onSelect, onMediaDrop }: { device: Television; pendingMedia?: PendingMediaTransfer; mediaReady?: MediaReadyState; mediaError?: MediaErrorState; selected: boolean; checked: boolean; onToggleChecked: () => void; onCommand: (evento: AdminCommandEvent, datos: Record<string, unknown>) => boolean; onChange: (changes: Partial<Television>) => void; onEdit: () => void; onDelete: () => void; onSelect: () => void; onMediaDrop: (file: File, kind: "IMAGE" | "VIDEO", contentId?: string) => void }) {
  const [isDraggingVideo, setIsDraggingVideo] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [showVolumeValue, setShowVolumeValue] = useState(false);
  const [volumeBeforeMute, setVolumeBeforeMute] = useState(device.volume > 0 ? device.volume : 50);
  const [awaitingMedia, setAwaitingMedia] = useState<{ baseline: number; errorBaseline: number; file: File; kind: "IMAGE" | "VIDEO" } | null>(null);
  const { transfer, progress, isUploading, error: dropError } = useMediaTransfer();
  const connectionStatus = device.connectionStatus ?? (device.status === "offline" ? "offline" : "online");
  const isWaitingForTv = Boolean(pendingMedia || awaitingMedia);
  const lastContactLabel = device.lastContactAt
    ? new Intl.DateTimeFormat("es-BO", { dateStyle: "short", timeStyle: "short" }).format(new Date(device.lastContactAt))
    : "No disponible";
  const commandData = { tv_id: device.tvCode ?? device.id, ...(device.currentContentId ? { contenido_id: device.currentContentId } : {}) };

  const sendQuickCommand = (event: AdminCommandEvent, changes: Partial<Television>, extra?: Record<string, unknown>) => {
    if (onCommand(event, { ...commandData, ...extra })) onChange(changes);
  };

  const toggleVideoPlayback = () => {
    if (device.contentType === "IMAGE" || connectionStatus === "offline" || isWaitingForTv) return;
    const playing = device.playbackState === "playing";
    sendQuickCommand(playing ? "media.pause" : "media.play", {
      status: playing ? "available" : "playing",
      playbackState: playing ? "paused" : "playing",
    });
  };

  const toggleMute = () => {
    if (connectionStatus === "offline" || isWaitingForTv) return;
    if (device.volume > 0) {
      setVolumeBeforeMute(device.volume);
      sendQuickCommand("media.volume", { volume: 0 }, { volumen: 0 });
      return;
    }
    const restoredVolume = Math.max(1, volumeBeforeMute);
    sendQuickCommand("media.volume", { volume: restoredVolume }, { volumen: restoredVolume });
  };

  useEffect(() => {
    if (!awaitingMedia || !mediaReady || mediaReady.sequence <= awaitingMedia.baseline) return;
    let cancelled = false;
    queueMicrotask(() => {
      if (cancelled) return;
      onMediaDrop(awaitingMedia.file, awaitingMedia.kind, typeof mediaReady.content.id === "string" ? mediaReady.content.id : undefined);
      setAwaitingMedia(null);
    });
    return () => { cancelled = true; };
  }, [awaitingMedia, mediaReady, onMediaDrop]);

  useEffect(() => {
    if (!awaitingMedia || !mediaError || mediaError.sequence <= awaitingMedia.errorBaseline) return;
    queueMicrotask(() => setAwaitingMedia(null));
  }, [awaitingMedia, mediaError]);

  const handleDragOver = (event: DragEvent<HTMLElement>) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "copy";
    setIsDraggingVideo(true);
  };

  const handleDrop = async (event: DragEvent<HTMLElement>) => {
    event.preventDefault();
    setIsDraggingVideo(false);
    const file = event.dataTransfer.files[0];
    if (!file) return;
    setAwaitingMedia(null);
    const baseline = mediaReady?.sequence ?? 0;
    const kind = await transfer(file, device.tvCode ?? device.id);
    if (kind) setAwaitingMedia({ baseline, errorBaseline: mediaError?.sequence ?? 0, file, kind });
  };

  return (
    <article
      className={`relative min-w-0 cursor-pointer rounded-2xl border bg-white p-3 text-left shadow-[0_7px_20px_rgba(25,45,38,0.07)] transition ${isDraggingVideo ? "scale-[1.01] border-[#f5b942] ring-3 ring-[#f5b942]/25" : selected ? "border-[#cbd8d3] shadow-[0_10px_26px_rgba(25,45,38,0.11)]" : "border-[#e2e6e4] hover:-translate-y-0.5 hover:shadow-lg"}`}
      onClick={onSelect}
      onDragEnter={handleDragOver}
      onDragOver={handleDragOver}
      onDragLeave={() => setIsDraggingVideo(false)}
      onDrop={handleDrop}
    >
      <span className="flex min-h-16 items-start justify-between gap-2">
        <span className="min-w-0">
          <span className="flex items-center gap-2">
            <input type="checkbox" checked={checked} onClick={(event) => event.stopPropagation()} onChange={onToggleChecked} aria-label={`Seleccionar ${device.name}`} className="size-4 accent-[#146be8]" />
            <strong className="block truncate text-base">{device.name}</strong>
            </span>
          <small className="mt-1 block truncate text-sm text-[#85878a]">
            {device.room}
            <span className="mx-1 text-gray-400">&raquo;</span>
            <span className="text-xs text-gray-500">
              {device.location}
            </span>
          </small>
        </span>
        <span className="relative ml-auto flex shrink-0 items-center gap-1">
          <em className={`flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-medium not-italic ${connectionChipStyles[connectionStatus]}`}><i className={`size-2 rounded-full ${connectionDotStyles[connectionStatus]}`} />{connectionLabels[connectionStatus]}</em>
          <button type="button" onClick={(event) => { event.stopPropagation(); setMenuOpen((open) => !open); }} aria-label="Abrir acciones del televisor" aria-expanded={menuOpen} className="grid size-8 cursor-pointer place-items-center rounded-full border-0 bg-transparent text-[#69716e] transition hover:bg-[#eef2f0] hover:text-[#202925]"><MoreVertical size={20} /></button>
          {menuOpen && <div className="absolute right-0 top-9 z-30 w-40 overflow-hidden rounded-xl border border-[#dfe4e2] bg-white p-1.5 shadow-[0_12px_32px_rgba(20,35,29,0.18)]" onClick={(event) => event.stopPropagation()}>
            <button type="button" onClick={() => { setMenuOpen(false); onEdit(); }} className="flex h-10 w-full cursor-pointer items-center gap-2 rounded-lg border-0 bg-white px-3 text-left text-sm font-medium hover:bg-[#f2f6f4]"><Pencil size={16} className="text-[#146be8]" /> Editar</button>
            <button type="button" onClick={() => { setMenuOpen(false); onDelete(); }} className="flex h-10 w-full cursor-pointer items-center gap-2 rounded-lg border-0 bg-white px-3 text-left text-sm font-medium text-[#c43b42] hover:bg-[#fff0f0]"><Trash2 size={16} className="text-[#c43b42]" /> Eliminar</button></div>}
        </span>
      </span>
      <span className={`relative mt-3 flex h-37.5 items-center justify-center overflow-hidden rounded-[14px] bg-[#090c0b] text-white shadow-[0_8px_18px_rgba(0,0,0,0.16)] ${device.contentType !== "IMAGE" && connectionStatus !== "offline" && !isWaitingForTv ? "cursor-pointer" : ""}`} onClick={(event) => { if (device.contentType === "IMAGE") return; event.stopPropagation(); toggleVideoPlayback(); }}>
        {connectionStatus === "offline" ? (
          <span className="flex flex-col items-center justify-center gap-1.5 text-center text-white/75">
            <MonitorOff aria-hidden="true" size={42} strokeWidth={1.5} />
            <strong className="mt-1 text-sm font-medium text-white/90">Sin señal</strong>
            <small className="text-[11px] text-white/55">Último contacto:</small>
            <small className="text-[11px] text-white/70">{lastContactLabel}</small>
          </span>
        ) : device.contentType === "IMAGE"
          ? <ImageIcon aria-hidden="true" size={58} strokeWidth={1.7} className="text-[#66706e]" />
          : <button type="button" disabled={isWaitingForTv} onClick={(event) => { event.stopPropagation(); toggleVideoPlayback(); }} aria-label={device.playbackState === "playing" ? "Pausar video" : "Reproducir video"} aria-pressed={device.playbackState === "playing"} className="grid size-12 cursor-pointer place-items-center rounded-full border border-white/30 bg-black/35 text-white backdrop-blur-sm transition hover:scale-105 hover:bg-black/55 disabled:cursor-not-allowed disabled:opacity-40">{device.playbackState === "playing" ? <Pause size={23} fill="currentColor" /> : <Play size={23} fill="currentColor" />}</button>}
        {connectionStatus !== "offline" && device.contentType !== "IMAGE" && (
          <span className="absolute inset-x-0 bottom-0 bg-linear-to-t from-black/95 via-black/65 to-transparent px-3 pt-8 pb-2.5">
            {/* <span className="mb-2 block h-1 overflow-hidden rounded-full bg-white/35"><i className="block h-full rounded-full bg-[#146be8]" style={{ width: device.playbackState === "playing" ? "42%" : `${Math.min(device.playbackPosition ?? 0, 100)}%` }} /></span> */}
            <span className="flex items-center gap-2 text-[11px] text-white/90">
              {device.playbackState === "playing" ? <Pause size={14} fill="currentColor" /> : <Play size={14} fill="currentColor" />}
              <span>{formatPlaybackTime(device.playbackPosition)} / 00:00</span>
              <span className="relative ml-auto flex items-center gap-1.5" onClick={(event) => event.stopPropagation()} onPointerDown={(event) => { event.stopPropagation(); setShowVolumeValue(true); }} onMouseEnter={() => setShowVolumeValue(true)} onMouseLeave={() => setShowVolumeValue(false)}>
                <span className="sr-only">Volumen {device.volume}%</span>
                <button type="button" disabled={isWaitingForTv} onClick={(event) => { event.preventDefault(); event.stopPropagation(); toggleMute(); }} aria-label={device.volume === 0 ? `Restaurar volumen a ${volumeBeforeMute}` : "Silenciar TV"} title={device.volume === 0 ? "Restaurar volumen" : "Silenciar"} className="grid size-5 shrink-0 cursor-pointer place-items-center border-0 bg-transparent p-0 text-white disabled:cursor-not-allowed disabled:opacity-45">{device.volume === 0 ? <VolumeX size={16} /> : <Volume2 size={16} />}</button>
                <span className="relative flex w-14 items-center">
                  {showVolumeValue && <output className="absolute -top-8 grid min-w-8 -translate-x-1/2 place-items-center rounded-md bg-white px-1.5 py-1 text-[10px] font-bold text-[#202226] shadow-md" style={{ left: `${device.volume}%` }}>{device.volume}</output>}
                  <input type="range" min={0} max={100} step={1} value={device.volume} aria-label={`Volumen ${device.volume}%`} disabled={isWaitingForTv} onFocus={() => setShowVolumeValue(true)} onBlur={() => setShowVolumeValue(false)} onChange={(event) => { const volume = Number(event.target.value); sendQuickCommand("media.volume", { volume }, { volumen: volume }); }} className="card-volume-range w-14 cursor-pointer disabled:cursor-not-allowed disabled:opacity-45" style={{ background: `linear-gradient(to right, #1887f2 0 ${device.volume}%, rgba(255,255,255,.42) ${device.volume}% 100%)` }} />
                </span>
              </span>
            </span>
          </span>
        )}
        {isDraggingVideo && (
          <span className="absolute inset-0 flex flex-col items-center justify-center gap-2 rounded-[14px] border-2 border-dashed border-[#f5b942] bg-[#15130d]/95 text-[#ffd879]">
            <UploadCloud aria-hidden="true" size={34} />
            <strong className="text-sm">Soltar imagen o video aquí</strong>
          </span>
        )}
        {isUploading && progress !== null && (
          <span className="absolute inset-x-3 bottom-3 overflow-hidden rounded-full bg-white/25" role="progressbar" aria-label="Progreso de transferencia" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress}>
            <span className="block h-2 rounded-full bg-[#f5b942] transition-[width] duration-150" style={{ width: `${progress}%` }} />
          </span>
        )}
        {isWaitingForTv && (
          <span className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/80 text-white">
            <LoaderCircle aria-hidden="true" size={32} className="animate-spin" />
            <strong className="px-4 text-center text-sm">Esperando que la TV termine la descarga…</strong>
            {pendingMedia && <small className="max-w-[85%] truncate text-white/70">{pendingMedia.fileName}</small>}
          </span>
        )}
      </span>
      {dropError && <small role="alert" className="mt-2 block rounded-lg bg-[#fff0f0] px-3 py-2 text-sm text-[#b4232c]">{dropError}</small>}
      <span className="block pt-3">
        <strong className="block truncate text-sm font-medium">{device.currentContent}</strong>
        <small className="mt-1 flex items-center gap-2 truncate text-[#747b7d]"><i className={`size-2.5 shrink-0 rounded-full ${playbackActivityColor(device)}`} /><span className="truncate">{playbackActivityLabel(device)}</span></small>
      </span>
      <div className="relative mt-3 flex items-center gap-2 border-t border-[#e8ebe9] pt-3" onClick={(event) => event.stopPropagation()}>
        {device.contentType === "IMAGE" ? (
          <button type="button" disabled={connectionStatus === "offline" || isWaitingForTv} onClick={() => sendQuickCommand(device.playbackState === "playing" ? "media.hide" : "media.show", { status: device.playbackState === "playing" ? "available" : "playing", playbackState: device.playbackState === "playing" ? "stopped" : "playing" })} className="flex h-9 flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-lg border border-[#dce2df] bg-white text-sm font-medium text-[#303537] disabled:opacity-40">{device.playbackState === "playing" ? <EyeOff size={16} className="text-[#146be8]" /> : <ImageIcon size={16} className="text-[#146be8]" />}{device.playbackState === "playing" ? "Ocultar" : "Mostrar"}</button>
        ) : (
          <><button type="button" disabled={connectionStatus === "offline" || isWaitingForTv} onClick={() => { const playing = device.playbackState === "playing"; sendQuickCommand(playing ? "media.pause" : "media.play", { status: playing ? "available" : "playing", playbackState: playing ? "paused" : "playing" }); }} className="flex h-9 flex-1 cursor-pointer items-center justify-center gap-1 rounded-lg border border-[#dce2df] bg-white px-2 text-xs font-medium text-[#303537] disabled:opacity-40">
            {device.playbackState === "playing" ? <Pause size={20} className="text-[#146be8]" /> : <Play size={20} className="text-[#146be8]" />}{device.playbackState === "playing" ? "Pausar" : "Play"}</button>
            <button type="button" disabled={connectionStatus === "offline" || isWaitingForTv} onClick={() => sendQuickCommand("media.stop", { status: "available", playbackState: "stopped" })} className="flex h-9 flex-1 cursor-pointer items-center justify-center gap-1 rounded-lg border border-[#dce2df] bg-white px-2 text-xs font-medium text-[#303537] disabled:opacity-40"><CircleStop size={20} className="text-[#d23f47]" />Detener</button>
            <button type="button" disabled={connectionStatus === "offline" || isWaitingForTv || !device.currentContentId} aria-pressed={Boolean(device.repeat)} onClick={(event) => { event.stopPropagation(); const repetir = !device.repeat; sendQuickCommand("media.repeat", { repeat: repetir }, { repetir }); }} style={{ color: device.repeat ? "#ffffff" : "#303537" }} className={`flex h-9 flex-1 cursor-pointer items-center justify-center gap-1 rounded-lg border px-2 text-xs font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${device.repeat ? "border-[#0b57b7] bg-[#0b63ce] hover:bg-[#084faa]" : "border-[#dce2df] bg-white hover:bg-[#f2f6fb]"}`}><Repeat2 size={20} className={device.repeat ? "text-white" : "text-[#4c6f9d]"} />Repetir</button></>
        )}
      </div>
    </article>
  );
}

function ControlPanel({ device, isMediaPending, mediaReady, mediaError, onCommand, onChange }: { device: Television; isMediaPending: boolean; mediaReady?: MediaReadyState; mediaError?: MediaErrorState; onCommand: (evento: AdminCommandEvent, datos: Record<string, unknown>) => boolean; onChange: (changes: Partial<Television>) => void }) {
  const [commandError, setCommandError] = useState<string | null>(null);
  const connectionStatus = device.connectionStatus ?? (device.status === "offline" ? "offline" : "online");
  const indicatorStyle = connectionStatus === "online" ? statusStyles[device.status] : connectionStyles[connectionStatus];
  const playbackLabel = device.playbackState === "paused" ? "Pausado" : device.playbackState === "stopped" ? "Detenido" : device.playbackState === "playing" ? "Reproduciendo" : "Listo";
  const isImage = device.contentType === "IMAGE";
  const isImageVisible = isImage && device.playbackState === "playing";
  const tvId = device.tvCode ?? device.id;
  const contentId = mediaReady && typeof mediaReady.content.id === "string" ? mediaReady.content.id : device.currentContentId;
  const transferReady = Boolean(mediaReady || device.currentContentId || device.currentContent !== "Sin reproducción");
  const lastContact = device.lastContactAt ? new Intl.DateTimeFormat("es-BO", { dateStyle: "short", timeStyle: "short" }).format(new Date(device.lastContactAt)) : "No disponible";

  const sendCommand = (evento: AdminCommandEvent, changes?: Partial<Television>, extra?: Record<string, unknown>) => {
    const sent = onCommand(evento, { tv_id: tvId, ...(contentId ? { contenido_id: contentId } : {}), ...extra });
    if (!sent) return setCommandError("No se pudo enviar la orden porque Socket.IO está desconectado.");
    setCommandError(null);
    if (changes) onChange(changes);
  };

  return (
    <aside className="h-auto w-full overflow-y-auto rounded-[20px] border border-[#e0e5e3] bg-white px-5 py-5 text-[#202226] shadow-[0_12px_35px_rgba(25,45,38,0.08)] xl:h-190">
      <h2 className="m-0 flex items-center gap-2 text-[22px] font-semibold"><Monitor size={21} /> Detalles del televisor</h2>
      <p className="mt-3 flex items-center gap-2 text-sm text-[#646b6e]"><i aria-hidden="true" className={`size-2.5 rounded-full ${indicatorStyle}`} />{connectionLabels[connectionStatus]}</p>

      <dl className="mt-4 grid grid-cols-[100px_minmax(0,1fr)] gap-x-3 gap-y-2 border-b border-[#e5e9e7] pb-5 text-sm">
        <dt className="text-[#778083]">Nombre</dt><dd className="truncate font-medium">{device.name}</dd>
        <dt className="text-[#778083]">Ubicación</dt><dd className="truncate">{device.location ?? device.room}</dd>
        <dt className="text-[#778083]">Código</dt><dd className="truncate">{device.tvCode ?? device.id}</dd>
        <dt className="text-[#778083]">Dirección IP</dt><dd>{device.ip}</dd>
        <dt className="text-[#778083]">Último contacto</dt><dd>{lastContact}</dd>
      </dl>

      <section className="border-b border-[#e5e9e7] py-5">
        <h3 className="mb-3 flex items-center gap-2 font-semibold"><Play size={17} className="text-[#146be8]" /> Contenido actual</h3>
        <div className="flex gap-3">
          <div className="relative grid h-17 w-27 shrink-0 place-items-center overflow-hidden rounded-lg bg-[#090c0b] text-[#78817f]">{isImage ? <ImageIcon size={30} /> : <MonitorPlay size={30} />}</div>
          <span className="min-w-0">
            <strong className="block truncate text-sm">{device.currentContent}</strong>
            <small className="mt-1 block text-[#777d80]">{isImage ? "Imagen" : `Video.${playbackLabel}`}</small>
            <small className="mt-1 block text-[#777d80]">Volumen {device.volume}%</small>
          </span>
        </div>
        
        <div className="mt-3 flex items-center gap-2">
          {isImage ? <button type="button" disabled={connectionStatus === "offline" || isMediaPending} onClick={() => sendCommand(isImageVisible ? "media.hide" : "media.show", { status: isImageVisible ? "available" : "playing", playbackState: isImageVisible ? "stopped" : "playing" })} className="flex h-9 flex-1 cursor-pointer items-center justify-center gap-2 rounded-lg border border-[#dce2df] bg-white text-sm font-semibold disabled:opacity-40">{isImageVisible ? <EyeOff size={16} /> : <ImageIcon size={16} />}{isImageVisible ? "Ocultar" : "Mostrar"}</button> : <><button type="button" disabled={connectionStatus === "offline" || isMediaPending} onClick={() => sendCommand(device.playbackState === "playing" ? "media.pause" : "media.play", { status: device.playbackState === "playing" ? "available" : "playing", playbackState: device.playbackState === "playing" ? "paused" : "playing" })} className="flex h-9 flex-1 cursor-pointer items-center justify-center gap-2 rounded-lg border border-[#dce2df] bg-white text-sm font-semibold disabled:opacity-40">{device.playbackState === "playing" ? <Pause size={16} /> : <Play size={16} />}{device.playbackState === "playing" ? "Pausar" : "Reproducir"}</button><button type="button" disabled={connectionStatus === "offline" || isMediaPending} onClick={() => sendCommand("media.stop", { status: "available", playbackState: "stopped" })} className="grid size-9 cursor-pointer place-items-center rounded-lg border border-[#dce2df] bg-white disabled:opacity-40"><CircleStop size={16} /></button></>}
        </div>
      </section>

      <section className="border-b border-[#e5e9e7] py-5">
        <div className="mb-2 flex items-center justify-between text-sm"><strong>Estado del contenido</strong><span>{isMediaPending ? <LoaderCircle size={16} className="animate-spin text-[#146be8]" /> : transferReady ? "100%" : "0%"}</span></div>
        <div className="h-2.5 overflow-hidden rounded-full bg-[#e4e9e7]"><div className={`h-full rounded-full ${mediaError ? "bg-[#d74747]" : isMediaPending ? "w-1/2 animate-pulse bg-[#146be8]" : "bg-[#20ad78]"}`} style={isMediaPending ? undefined : { width: transferReady || mediaError ? "100%" : "0%" }} /></div>
        <small className={`mt-2 block ${mediaError ? "text-[#b4232c]" : isMediaPending ? "text-[#146be8]" : "text-[#747b7d]"}`}>{mediaError ? `${mediaError.code}: ${mediaError.message}` : isMediaPending ? "Esperando que la TV termine la descarga…" : transferReady ? "Completado · Contenido listo" : "Sin transferencias recientes"}</small>
      </section>

      <section className="py-5">
        <h3 className="mb-4 flex items-center gap-2 font-semibold"><History size={18} /> Historial reciente</h3>
        <div className="space-y-4 text-sm">
          <div className="flex gap-3"><i className={`mt-1.5 size-2.5 shrink-0 rounded-full ${indicatorStyle}`} /><span className="min-w-0"><strong className="block truncate">{device.currentContent}</strong><small className="text-[#777d80]">{playbackLabel} · {lastContact}</small></span></div>
          <div className="flex gap-3"><i className="mt-1.5 size-2.5 shrink-0 rounded-full bg-[#20ad78]" /><span><strong className="block">Dispositivo sincronizado</strong><small className="text-[#777d80]">Estado recibido por websocket</small></span></div>
        </div>
      </section>
      {commandError && <p role="alert" className="mt-3 rounded-lg bg-[#fff0f0] px-3 py-2 text-sm text-[#b4232c]">{commandError}</p>}
    </aside>
  );
}
