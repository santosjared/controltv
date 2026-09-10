"use client";

import { useEffect, useMemo, useState, type CSSProperties, type DragEvent } from "react";
import {
  Bell,
  ChevronRight,
  CircleStop,
  FileVideo,
  ImageIcon,
  LoaderCircle,
  Maximize2,
  Monitor,
  MonitorPlay,
  Pause,
  Play,
  Search,
  Send,
  Settings,
  UploadCloud,
  Video,
  Volume2,
  Wifi,
} from "lucide-react";
import type { Television, TelevisionConnectionStatus, TelevisionStatus } from "../types";
import { useGetTelevisionsQuery, useRegisterConnectedTvMutation } from "../api/televisions-api";
import { useConnectedTvs, type MediaReadyState } from "../hooks/use-connected-tvs";
import { useMediaTransfer } from "../hooks/use-media-transfer";
import { MEDIA_FILE_ACCEPT } from "../utils/media-file";

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

const statusBorderStyles: Record<TelevisionStatus, string> = {
  playing: "border-l-[#246bfd]",
  available: "border-l-[#20ad78]",
  offline: "border-l-[#d74747]",
};

const statusPanelStyles: Record<TelevisionStatus, string> = {
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

const connectionBorderStyles: Record<TelevisionConnectionStatus, string> = {
  online: "border-l-[#20ad78]",
  "low-signal": "border-l-[#e1a12d]",
  offline: "border-l-[#d74747]",
};

const emptyTelevisions: Television[] = [];

export function ControlTvDashboard() {
  const { data = emptyTelevisions, isLoading, isFetching, error, refetch } = useGetTelevisionsQuery(undefined, { refetchOnFocus: true, refetchOnReconnect: true });
  const { socketDevices, onlineTvIds, lowSignalTvIds, hasStatusSnapshot, mediaReadyByTvId, isSocketConnected } = useConnectedTvs();
  // Cambios visuales locales; no se envían comandos sin endpoints confirmados.
  const [overrides, setOverrides] = useState<Record<string, Partial<Television>>>({});
  const sourceDevices = error ? emptyTelevisions : data;
  const devices = useMemo(() => {
    const onlineIds = new Set(onlineTvIds);
    const lowSignalIds = new Set(lowSignalTvIds);

    return sourceDevices.map((device) => {
      const localDevice = { ...device, ...overrides[device.id] };
      const tvCode = device.tvCode ?? device.id;
      const isLowSignal = hasStatusSnapshot && lowSignalIds.has(tvCode);
      const isOnline = hasStatusSnapshot && onlineIds.has(tvCode);

      if (!isOnline) return { ...localDevice, status: "offline" as const, connectionStatus: "offline" as const };
      return {
        ...localDevice,
        status: localDevice.status === "offline" ? "available" as const : localDevice.status,
        connectionStatus: isLowSignal ? "low-signal" as const : "online" as const,
      };
    });
  }, [sourceDevices, overrides, onlineTvIds, lowSignalTvIds, hasStatusSnapshot]);
  const [registeredPendingIds, setRegisteredPendingIds] = useState<string[]>([]);
  const pendingDevices = (socketDevices ?? emptyTelevisions).filter((device) => !registeredPendingIds.includes(device.id));
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [deviceToRegister, setDeviceToRegister] = useState<Television | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const selected = devices.find((device) => device.id === selectedId) ?? devices[0];
  const visibleDevices = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase("es");
    return normalized
      ? devices.filter((device) => `${device.room} ${device.name} ${device.tvCode ?? ""} ${device.location ?? ""}`.toLocaleLowerCase("es").includes(normalized))
      : devices;
  }, [devices, query]);

  const updateSelected = (changes: Partial<Television>) => {
    if (!selected) return;
    setOverrides((current) => ({ ...current, [selected.id]: { ...current[selected.id], ...changes } }));
  };

  const assignMedia = (deviceId: string, file: File, kind: "IMAGE" | "VIDEO") => {
    setOverrides((current) => ({ ...current, [deviceId]: { ...current[deviceId], currentContent: file.name, contentType: kind } }));
    setSelectedId(deviceId);
  };

  const online = devices.filter((device) => device.connectionStatus !== "offline").length;
  const lowSignal = devices.filter((device) => device.connectionStatus === "low-signal").length;
  const playing = devices.filter((device) => device.connectionStatus !== "offline" && device.status === "playing").length;
  const offline = devices.filter((device) => device.connectionStatus === "offline").length;

  return (
    <main className="min-h-screen bg-[#f2f2f2] text-[#202226]">
      <header className="flex min-h-27 items-center justify-between bg-[linear-gradient(110deg,#236b5b_0%,#307c69_46%,#d95461_100%)] px-5 py-5 text-white shadow-[0_8px_24px_rgba(75,94,86,0.18)] md:px-9">
        <div className="flex items-center gap-4.5">
          <span className="grid size-14 place-items-center rounded-[17px] bg-white/18 ring-1 ring-white/25">
            <Video aria-hidden="true" size={29} strokeWidth={1.8} />
          </span>
          <span>
            <strong className="block text-[22px] leading-tight tracking-[-0.6px] md:text-[28px]">Control TV</strong>
            <small className="mt-1 block text-[13px] text-[#d6ece6] md:text-base">Centro de distribución audiovisual</small>
          </span>
        </div>
        <div className="relative flex items-center gap-2.5">
          <button type="button" onClick={() => setNotificationsOpen((open) => !open)} className="relative flex h-12 cursor-pointer items-center gap-3 rounded-xl border border-white/25 bg-black/15 px-3 text-left shadow-[0_6px_16px_rgba(0,0,0,0.14)] transition hover:bg-black/25" aria-expanded={notificationsOpen} aria-label={`${pendingDevices.length} dispositivos pendientes de registro`}>
            <span className="relative grid size-8 place-items-center rounded-full bg-[#f5b942] text-[#4b3410]"><Bell size={17} />{pendingDevices.length > 0 && <i className="absolute -right-1.5 -top-1.5 grid size-5 place-items-center rounded-full bg-[#d74747] text-[11px] font-bold not-italic text-white ring-2 ring-white">{pendingDevices.length}</i>}</span>
            <span className="hidden leading-tight sm:block"><strong className="block text-sm">Nuevos dispositivos</strong><small className="flex items-center gap-1.5 text-xs text-white/75"><i className={`size-2 rounded-full ${isSocketConnected ? "bg-[#71e6a9]" : "bg-[#f5b942]"}`} />{pendingDevices.length} por registrar</small></span>
          </button>
          {notificationsOpen && <div className="absolute right-0 top-15 z-30 w-[min(360px,calc(100vw-32px))] overflow-hidden rounded-2xl border border-[#e5e7e6] bg-white text-[#202226] shadow-[0_20px_50px_rgba(0,0,0,0.22)]"><div className="border-b border-[#e8e9e9] px-4 py-3"><strong className="block">Dispositivos detectados</strong><small className="text-[#68696d]">Selecciona uno para registrarlo</small></div><div className="max-h-80 overflow-y-auto p-2">{pendingDevices.map((device) => <button key={device.id} type="button" onClick={() => { setDeviceToRegister(device); setNotificationsOpen(false); }} className="flex w-full cursor-pointer items-center gap-3 rounded-xl border-0 bg-transparent p-3 text-left transition hover:bg-[#f1f6f4]"><span className="grid size-10 shrink-0 place-items-center rounded-xl bg-[#e2f0ec] text-[#236b5b]"><Monitor size={20} /></span><span className="min-w-0 flex-1"><strong className="block truncate text-sm">{device.id}</strong><small className="block truncate text-[#68696d]">{device.model} · Android {device.androidVersion}</small><small className="block text-[#8a8d8c]">IP: {device.ip}</small></span><ChevronRight size={18} className="text-[#8a8d8c]" /></button>)}{pendingDevices.length === 0 && <p className="px-3 py-6 text-center text-sm text-[#68696d]">No hay dispositivos pendientes.</p>}</div></div>}
        </div>
      </header>

      <section className="grid grid-cols-1 gap-3.5 px-5 py-5 sm:grid-cols-2 xl:grid-cols-5 md:px-9 md:py-7.5" aria-label="Resumen de dispositivos">
        <Metric label="Televisores" value={devices.length} detail="Dispositivos registrados" bg="bg-[#2f7968]" />
        <Metric label="En línea" value={online} detail="Listos para transmitir" bg="bg-[#20ad78]" />
        <Metric label="Señal baja" value={lowSignal} detail="Requieren revisión" bg="bg-[#e1a12d]" />
        <Metric label="Reproduciendo" value={playing} detail="Transmisiones activas" bg="bg-[#246bfd]" />
        <Metric label="Sin Conexión" value={offline} detail="Dispositivos sin conexión" bg="bg-[#d74747]" />
      </section>

      <div className="grid items-start gap-7 px-5 pb-8 xl:grid-cols-[minmax(0,1fr)_450px] xl:px-9">
        <section className="min-w-0">
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
          <div className="grid max-h-145 grid-cols-1 gap-x-8 gap-y-8 overflow-y-auto px-2 pb-4 sm:grid-cols-2">
            {visibleDevices.map((device) => (
              <DeviceCard key={device.id} device={device} mediaReady={mediaReadyByTvId[device.tvCode ?? device.id]} selected={device.id === selected?.id} onSelect={() => setSelectedId(device.id)} onMediaDrop={(file, kind) => assignMedia(device.id, file, kind)} />
            ))}
            {isLoading && <p role="status">Cargando televisores registrados…</p>}
            {error && <div role="alert"><p>No se pudieron cargar los televisores registrados.</p><button className="mt-3 rounded bg-[#236b5b] px-4 py-2 text-white" disabled={isFetching} onClick={() => refetch()}>Reintentar</button></div>}
            {!isLoading && !error && visibleDevices.length === 0 && <p className="text-[#666970]">{devices.length === 0 ? "No hay televisores registrados." : "No encontramos salas con ese nombre."}</p>}
          </div>
        </section>
        {selected ? <div><ControlPanel key={selected.id} device={selected} mediaReady={mediaReadyByTvId[selected.tvCode ?? selected.id]} onChange={updateSelected} /></div> : <aside className="rounded-2xl bg-white p-7 text-[#666970]">Selecciona un televisor para ver su panel de control.</aside>}
      </div>
      {deviceToRegister && <RegisterDeviceDialog device={deviceToRegister} onCancel={() => setDeviceToRegister(null)} onRegistered={() => { setRegisteredPendingIds((current) => [...current, deviceToRegister.id]); setDeviceToRegister(null); }} />}
    </main>
  );
}

function RegisterDeviceDialog({ device, onCancel, onRegistered }: { device: Television; onCancel: () => void; onRegistered: () => void }) {
  const [nombre, setNombre] = useState("");
  const [sala, setSala] = useState("");
  const [ubicacion, setUbicacion] = useState("");
  const [identifyNotice, setIdentifyNotice] = useState(false);
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
        <div className="flex items-center justify-between border-b border-[#e7e9e8] px-6 py-5"><div><span className="text-xs font-bold tracking-[0.14em] text-[#d74747]">NUEVO DISPOSITIVO</span><h2 id="register-device-title" className="mt-1 text-2xl font-semibold">Registrar televisor</h2></div><button type="button" onClick={onCancel} className="grid size-9 cursor-pointer place-items-center rounded-full border-0 bg-[#f1f3f2] text-xl" aria-label="Cerrar">×</button></div>
        <form onSubmit={submit} className="px-6 py-6">
          <div className="mb-6 rounded-2xl bg-[#f1f6f4] p-5">
            <div className="flex items-start gap-4"><span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-[#236b5b] text-white"><Monitor size={24} /></span><div className="min-w-0"><strong className="block truncate text-xl">{device.id}</strong><p className="mt-1 font-medium">{device.model}</p><p className="mt-1 text-sm text-[#68696d]">Android {device.androidVersion} · IP: {device.ip}</p></div></div>
            <button type="button" onClick={() => setIdentifyNotice(true)} className="mt-5 flex h-11 w-full cursor-pointer items-center justify-center gap-2 rounded-xl border border-[#236b5b] bg-white font-semibold text-[#236b5b] transition hover:bg-[#e5f1ed]"><Monitor size={19} /> Identificar TV</button>
            {identifyNotice && <p className="mt-2 text-center text-xs text-[#68696d]">El diseño está listo; falta el endpoint del backend para enviar la señal de identificación.</p>}
          </div>
          <div className="space-y-4">
            <FormField label="Nombre del televisor" placeholder="TV Emergencias" value={nombre} onChange={setNombre} maxLength={100} />
            <FormField label="Nombre de la sala" placeholder="Emergencias" value={sala} onChange={setSala} maxLength={100} />
            <FormField label="Ubicación" placeholder="Piso 1" value={ubicacion} onChange={setUbicacion} maxLength={200} />
          </div>
          {(!hasValidTvId || !hasDeviceMetadata) && <p role="alert" className="mt-4 rounded-lg bg-[#fff8e6] px-3 py-2 text-sm text-[#76520d]">El dispositivo no cumple el contrato de registro: verifica tv_id, modelo, versión de Android e IP.</p>}
          {error && <p role="alert" className="mt-4 rounded-lg bg-[#fff0f0] px-3 py-2 text-sm text-[#b4232c]">No se pudo registrar. Revisa los datos e inténtalo nuevamente.</p>}
          <div className="mt-7 flex justify-end gap-3"><button type="button" onClick={onCancel} className="h-11 cursor-pointer rounded-xl border border-[#d8dcda] bg-white px-5 font-medium">Cancelar</button><button type="submit" disabled={isLoading || !canRegister} className="h-11 cursor-pointer rounded-xl border-0 bg-[#236b5b] px-6 font-semibold text-white transition hover:bg-[#195447] disabled:cursor-not-allowed disabled:opacity-50">{isLoading ? "Registrando…" : "Registrar"}</button></div>
        </form>
      </section>
    </div>
  );
}

function FormField({ label, placeholder, value, onChange, maxLength }: { label: string; placeholder: string; value: string; onChange: (value: string) => void; maxLength: number }) {
  return <label className="block"><span className="mb-1.5 block text-sm font-semibold">{label}</span><input required value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} maxLength={maxLength} className="h-12 w-full rounded-xl border border-[#d8dcda] bg-white px-4 outline-none transition focus:border-[#236b5b] focus:ring-3 focus:ring-[#236b5b]/12" /></label>;
}

function Metric({ label, value, detail, bg }: { label: string; value: number; detail: string; bg: string }) {
  return (
    <article className={`flex h-26.25 flex-col rounded-2xl ${bg} px-5 py-4 text-white shadow-[0_10px_25px_rgba(35,107,91,0.14)] md:h-35 md:px-6 md:py-6`}>
      <span className="text-base uppercase text-[#d9eee8]">{label}</span>
      <strong className="text-[34px] leading-10 font-medium text-white">{value}</strong>
      <small className="text-[17px] text-[#e1f1ed]">{detail}</small>
    </article>
  );
}

function DeviceCard({ device, mediaReady, selected, onSelect, onMediaDrop }: { device: Television; mediaReady?: MediaReadyState; selected: boolean; onSelect: () => void; onMediaDrop: (file: File, kind: "IMAGE" | "VIDEO") => void }) {
  const [isDraggingVideo, setIsDraggingVideo] = useState(false);
  const [awaitingMedia, setAwaitingMedia] = useState<{ baseline: number; file: File; kind: "IMAGE" | "VIDEO" } | null>(null);
  const { transfer, progress, isUploading, isComplete, error: dropError } = useMediaTransfer();
  const connectionStatus = device.connectionStatus ?? (device.status === "offline" ? "offline" : "online");
  const badgeLabel = connectionStatus === "online" ? statusLabels[device.status] : connectionLabels[connectionStatus];
  const badgeStyle = connectionStatus === "online" ? statusStyles[device.status] : connectionStyles[connectionStatus];
  const borderStyle = connectionStatus === "online" ? statusBorderStyles[device.status] : connectionBorderStyles[connectionStatus];

  useEffect(() => {
    if (!awaitingMedia || !mediaReady || mediaReady.sequence <= awaitingMedia.baseline) return;
    let cancelled = false;
    queueMicrotask(() => {
      if (cancelled) return;
      onMediaDrop(awaitingMedia.file, awaitingMedia.kind);
      setAwaitingMedia(null);
    });
    return () => { cancelled = true; };
  }, [awaitingMedia, mediaReady, onMediaDrop]);

  const handleDragOver = (event: DragEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "copy";
    setIsDraggingVideo(true);
  };

  const handleDrop = async (event: DragEvent<HTMLButtonElement>) => {
    event.preventDefault();
    setIsDraggingVideo(false);
    const file = event.dataTransfer.files[0];
    if (!file) return;
    setAwaitingMedia(null);
    const baseline = mediaReady?.sequence ?? 0;
    const kind = await transfer(file, device.tvCode ?? device.id);
    if (kind) setAwaitingMedia({ baseline, file, kind });
  };

  return (
    <button
      className={`min-w-0 cursor-pointer rounded-xl border-0 bg-transparent p-0 text-left transition focus-visible:outline-3 focus-visible:outline-[#246bfd]/25 ${isDraggingVideo ? "scale-[1.01] ring-4 ring-[#f5b942] ring-offset-4" : selected ? "bg-[#e8e8e8] shadow-[0_0_0_15px_#e8e8e8]" : "hover:-translate-y-0.5"}`}
      onClick={onSelect}
      onDragEnter={handleDragOver}
      onDragOver={handleDragOver}
      onDragLeave={() => setIsDraggingVideo(false)}
      onDrop={handleDrop}
      aria-label={`Administrar ${device.room}`}
    >
      <span className={`flex h-17.25 items-start justify-between gap-2 rounded-l-sm border-l-4 pl-3 ${borderStyle}`}>
        <span className="min-w-0">
          <strong className="block truncate text-xl">{device.room}</strong>
          <small className="mt-1 flex items-center gap-2 truncate text-base text-[#696a6d]">
            <i aria-hidden="true" className={`size-2 shrink-0 rounded-full ${badgeStyle}`} />
            <span className="truncate">{device.name}</span>
          </small>
          {device.location && <small className="mt-1 block truncate text-sm text-[#85878a]">{device.location}</small>}
        </span>
        <em className={`whitespace-nowrap rounded-2xl px-3.5 py-1.5 text-sm not-italic text-white ${badgeStyle}`}>{badgeLabel}</em>
      </span>
      <span className="relative mt-3 flex h-37.5 items-center justify-center rounded-[14px] bg-[#090c0b] text-white shadow-[0_8px_18px_rgba(0,0,0,0.16)]">
        {device.contentType === "IMAGE"
          ? <ImageIcon aria-hidden="true" size={58} strokeWidth={1.7} className="text-[#66706e]" />
          : <Video aria-hidden="true" size={58} strokeWidth={1.7} className="text-[#66706e]" />}
        <b className="absolute bottom-2.5 left-3.5 text-base font-normal">{device.currentContent}</b>
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
        {awaitingMedia && (
          <span className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/80 text-white">
            <LoaderCircle aria-hidden="true" size={32} className="animate-spin" />
            <strong className="text-sm">Esperando respuesta de la TV…</strong>
          </span>
        )}
      </span>
      {isComplete && !awaitingMedia && <small className="mt-2 block rounded-lg bg-[#e7f7ef] px-3 py-2 text-sm text-[#176b48]">Contenido listo para reproducir.</small>}
      {dropError && <small role="alert" className="mt-2 block rounded-lg bg-[#fff0f0] px-3 py-2 text-sm text-[#b4232c]">{dropError}</small>}
      <span className="flex justify-between gap-3 pt-4.5 text-base text-[#626468]">
        <span className="truncate">{device.tvCode ?? device.ip}</span>
        <span className="flex items-center gap-2 text-[#26282b]"><Wifi aria-hidden="true" size={17} />{connectionLabels[connectionStatus]}</span>
      </span>
    </button>
  );
}

function ControlPanel({ device, mediaReady, onChange }: { device: Television; mediaReady?: MediaReadyState; onChange: (changes: Partial<Television>) => void }) {
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);
  const [awaitingMedia, setAwaitingMedia] = useState<{ baseline: number; fileName: string; kind: "IMAGE" | "VIDEO" } | null>(null);
  const [confirmedMediaKind, setConfirmedMediaKind] = useState<"IMAGE" | "VIDEO" | null>(null);
  const { transfer, progress: uploadProgress, isUploading, isComplete, error: uploadError } = useMediaTransfer();
  const connectionStatus = device.connectionStatus ?? (device.status === "offline" ? "offline" : "online");
  const panelStyle = connectionStatus === "low-signal" ? "bg-[#b77916]" : connectionStatus === "offline" ? statusPanelStyles.offline : statusPanelStyles[device.status];
  const indicatorStyle = connectionStatus === "online" ? statusStyles[device.status] : connectionStyles[connectionStatus];
  const controlsReady = !isUploading && !awaitingMedia;
  const effectiveMediaKind = confirmedMediaKind ?? device.contentType;

  useEffect(() => {
    if (!awaitingMedia || !mediaReady || mediaReady.sequence <= awaitingMedia.baseline) return;
    let cancelled = false;
    queueMicrotask(() => {
      if (cancelled) return;
      const contentName = typeof mediaReady.content.nombre === "string" ? mediaReady.content.nombre : awaitingMedia.fileName;
      setConfirmedMediaKind(awaitingMedia.kind);
      onChange({ currentContent: contentName, contentType: awaitingMedia.kind, status: "available" });
      setAwaitingMedia(null);
    });
    return () => { cancelled = true; };
  }, [awaitingMedia, mediaReady, onChange]);

  const handleFileUpload = async (file?: File) => {
    if (!file) return;
    setUploadedFileName(file.name);
    setAwaitingMedia(null);
    setConfirmedMediaKind(null);
    const baseline = mediaReady?.sequence ?? 0;
    const kind = await transfer(file, device.tvCode ?? device.id);
    if (kind) setAwaitingMedia({ baseline, fileName: file.name, kind });
  };

  const lastContact = device.lastContactAt
    ? new Intl.DateTimeFormat("es-BO", { dateStyle: "short", timeStyle: "short" }).format(new Date(device.lastContactAt))
    : "No disponible";

  return (
    <aside className={`h-auto w-full overflow-y-auto rounded-[20px] px-4.5 py-6 text-white shadow-[0_16px_38px_rgba(0,0,0,0.16)] transition-colors duration-300 md:max-w-175 md:px-7 md:py-8 xl:h-164 ${panelStyle}`}>
      <h2 className="m-0 text-[25px] font-semibold text-white">Panel de control</h2>
      <a className="mt-1 mb-6 flex items-center gap-2 text-[17px] font-medium text-zinc-300 no-underline" href={`#${device.id}`}>
        <i aria-hidden="true" className={`size-2.5 shrink-0 rounded-full ring-2 ring-white/25 ${indicatorStyle}`} />
        <span>{device.room} · {connectionLabels[connectionStatus]}</span>
      </a>
      <div className="mb-5 grid grid-cols-2 gap-x-4 gap-y-2 rounded-xl bg-black/15 p-3 text-sm text-white/80">
        <span className="truncate"><strong className="text-white">TV:</strong> {device.name}</span>
        <span className="truncate"><strong className="text-white">Código:</strong> {device.tvCode ?? device.id}</span>
        <span className="truncate"><strong className="text-white">Modelo:</strong> {device.model ?? "No disponible"}</span>
        <span className="truncate"><strong className="text-white">Android:</strong> {device.androidVersion ?? "No disponible"}</span>
        <span className="truncate"><strong className="text-white">IP:</strong> {device.ip}</span>
        <span className="truncate"><strong className="text-white">Ubicación:</strong> {device.location ?? "No registrada"}</span>
        <span className="col-span-2 truncate"><strong className="text-white">Último contacto:</strong> {lastContact}</span>
      </div>
      <div className="group relative aspect-video w-full overflow-hidden rounded-[14px] bg-[#090c0b] text-white shadow-[0_12px_28px_rgba(0,0,0,0.24)]">
        {effectiveMediaKind === "IMAGE"
          ? <ImageIcon aria-hidden="true" size={70} strokeWidth={1.5} className="absolute left-1/2 top-[42%] -translate-x-1/2 -translate-y-1/2 text-[#66706e]" />
          : <MonitorPlay aria-hidden="true" size={70} strokeWidth={1.5} className="absolute left-1/2 top-[42%] -translate-x-1/2 -translate-y-1/2 text-[#66706e]" />}
        {controlsReady && (
          <button
            type="button"
            disabled={device.status === "offline"}
            onClick={() => onChange({ status: "playing" })}
            className="absolute left-1/2 top-[42%] grid size-14 -translate-x-1/2 -translate-y-1/2 cursor-pointer place-items-center rounded-2xl border-0 bg-[#ff0033] text-white shadow-lg transition hover:scale-105 hover:bg-[#e6002e] disabled:cursor-not-allowed disabled:bg-[#555]/80"
            aria-label={effectiveMediaKind === "IMAGE" ? "Mostrar imagen" : "Reproducir video"}
          >
            {effectiveMediaKind === "IMAGE" ? <ImageIcon size={27} /> : <Play size={28} fill="currentColor" />}
          </button>
        )}
        {!controlsReady && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-black/80 text-center">
            <LoaderCircle aria-hidden="true" size={40} className="animate-spin text-[#f5b942]" />
            <strong>{isUploading ? "Transfiriendo contenido…" : "Esperando respuesta de la TV…"}</strong>
            <small className="text-white/70">Los controles se habilitarán cuando el dispositivo confirme.</small>
          </div>
        )}
        {controlsReady && <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/95 via-black/65 to-transparent px-3.5 pt-10 pb-3">
          <div className="mb-2 h-1 w-full overflow-hidden rounded-full bg-white/35">
            <div className={`h-full rounded-full ${statusStyles[device.status]}`} style={{ width: device.status === "playing" ? "42%" : "0%" }} />
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {effectiveMediaKind === "IMAGE" ? (
                <button type="button" className="cursor-pointer border-0 bg-transparent p-0 text-white" onClick={() => onChange({ status: "playing" })} aria-label="Mostrar imagen"><ImageIcon size={20} /></button>
              ) : (
                <button type="button" className="cursor-pointer border-0 bg-transparent p-0 text-white" onClick={() => onChange({ status: device.status === "playing" ? "available" : "playing" })} aria-label={device.status === "playing" ? "Pausar" : "Reproducir"}>
                  {device.status === "playing" ? <Pause size={20} fill="currentColor" /> : <Play size={20} fill="currentColor" />}
                </button>
              )}
              <button type="button" className="cursor-pointer border-0 bg-transparent p-0 text-white" onClick={() => onChange({ status: "available", currentContent: "Sin reproducción" })} aria-label="Detener"><CircleStop size={20} /></button>
              {effectiveMediaKind !== "IMAGE" && <><Volume2 aria-hidden="true" size={20} /><input className="volume-range w-14 sm:w-20" aria-label="Volumen del reproductor" title={`Volumen: ${device.volume}%`} type="range" min="0" max="100" value={device.volume} onChange={(event) => onChange({ volume: Number(event.target.value) })} style={{ "--volume": `${device.volume}%` } as CSSProperties} /></>}
              <span className="max-w-40 truncate text-xs font-medium">{device.currentContent}</span>
            </div>
            <div className="flex items-center gap-3"><Settings aria-hidden="true" size={19} /><Maximize2 aria-hidden="true" size={19} /></div>
          </div>
        </div>}
      </div>
      <div className="mt-6 border-b border-white/25 pb-6">
        <strong className="mb-3 block text-lg">Subir contenido</strong>
        <label aria-busy={isUploading} className="flex cursor-pointer items-center gap-3 rounded-xl border-2 border-dashed border-white/45 bg-black/10 px-4 py-3 transition hover:border-white/80 hover:bg-black/15" htmlFor={`content-upload-${device.id}`}>
          <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-white/18"><UploadCloud aria-hidden="true" size={22} /></span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-semibold">Seleccionar imagen o video</span>
            <small className="mt-0.5 block truncate text-white/75">{uploadedFileName ?? "Solo imagen o video · Máximo 100 MB"}</small>
          </span>
          {effectiveMediaKind === "IMAGE" ? <ImageIcon aria-hidden="true" size={21} className="shrink-0 text-white/75" /> : <FileVideo aria-hidden="true" size={21} className="shrink-0 text-white/75" />}
        </label>
        {uploadProgress !== null && !uploadError && (
          <div className="mt-3" aria-live="polite">
            <div className="mb-1.5 flex items-center justify-between text-sm text-white/90">
              <span>{isUploading ? `Transfiriendo a ${device.tvCode ?? device.id}…` : isComplete ? "Transferencia completada" : "Preparando transferencia"}</span>
              <strong>{uploadProgress}%</strong>
            </div>
            <div
              className="h-2.5 overflow-hidden rounded-full bg-black/25 ring-1 ring-white/20"
              role="progressbar"
              aria-label="Progreso de carga del archivo"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={uploadProgress}
            >
              <div className="h-full rounded-full bg-white transition-[width] duration-150 ease-out" style={{ width: `${uploadProgress}%` }} />
            </div>
          </div>
        )}
        {awaitingMedia && (
          <div className="mt-3 flex items-center gap-3 rounded-xl bg-black/20 px-3 py-3" role="status" aria-live="polite">
            <LoaderCircle aria-hidden="true" size={24} className="shrink-0 animate-spin text-[#f5d06f]" />
            <span><strong className="block text-sm">Esperando confirmación de la TV</strong><small className="text-white/75">El archivo se transfirió; el dispositivo lo está preparando.</small></span>
          </div>
        )}
        {isComplete && !awaitingMedia && confirmedMediaKind && <p className="mt-3 rounded-xl bg-white/18 px-3 py-2 text-sm font-medium">Contenido listo para {confirmedMediaKind === "VIDEO" ? "reproducir" : "mostrar"}.</p>}
        {uploadError && <p role="alert" className="mt-2 rounded-lg bg-black/20 px-3 py-2 text-sm text-white">{uploadError}</p>}
        <input
          id={`content-upload-${device.id}`}
          className="sr-only"
          type="file"
          accept={MEDIA_FILE_ACCEPT}
          onChange={(event) => {
            void handleFileUpload(event.target.files?.[0]);
            event.currentTarget.value = "";
          }}
        />
      </div>
      <div>
        <h3 className="my-5 text-[21px] font-semibold">Contenido disponible</h3>
        <select disabled={!controlsReady} className="h-12 w-full rounded-md border border-white/50 bg-white px-3 text-[#202226] disabled:cursor-not-allowed disabled:opacity-60" aria-label="Contenido disponible" value={device.currentContent} onChange={(event) => onChange({ currentContent: event.target.value })}>
          <option>Información para pacientes</option><option>Campaña de vacunación</option><option>Canal institucional</option><option>Menú y horarios</option><option>Turnos de atención</option><option>Sin conexión</option>
        </select>
        <button className="mt-3 flex h-10.5 w-full cursor-pointer items-center justify-center gap-2 rounded-md border-0 bg-white font-medium text-[#202226] transition hover:bg-[#f2f2f2] disabled:cursor-not-allowed disabled:bg-white/40 disabled:text-white/70" disabled={device.status === "offline" || !controlsReady} onClick={() => onChange({ status: "playing" })}>
          <Send size={17} /> {effectiveMediaKind === "IMAGE" ? "Mostrar en pantalla" : "Reproducir en pantalla"}
        </button>
      </div>
    </aside>
  );
}
