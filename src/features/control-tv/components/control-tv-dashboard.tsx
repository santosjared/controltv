"use client";

import Image from "next/image";
import { TvVolumeControl } from "./tv-volume-control";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState, type DragEvent, type ReactNode } from "react";
import {
  Bell,
  AlertTriangle,
  CalendarDays,
  Check,
  ChevronDown,
  ChevronLeft,
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
  Shuffle,
  Trash2,
  UploadCloud,
  X,
  ListVideo,
  Users,
  Key,
  LogOut,
} from "lucide-react";
import type { Television, TelevisionConnectionStatus, TelevisionStatus } from "../types";
import { useDeleteTelevisionMutation, useGetTelevisionsQuery, useRegisterConnectedTvMutation, useUpdateTelevisionMutation } from "../api/televisions-api";
import { useConnectedTvs, type AdminCommandEvent, type MediaErrorState, type MediaReadyState } from "../hooks/use-connected-tvs";
import { useMediaTransfer } from "../hooks/use-media-transfer";
import { MEDIA_FILE_ACCEPT } from "../utils/media-file";
import { useAuth } from "@/features/auth/auth-context";
import { AppFooter } from "@/components/app-footer";
import { AppHeader } from "@/components/app-header";
import { SidebarBrand } from "@/components/sidebar-brand";
import { DashboardLibraryPanel } from "./dashboard-library-panel";
import { PlaybackRequestsPanel } from "./playback-requests-panel";
import { selectedPlaybackTargets, type PlaybackAction, type PlaybackSelection } from "../api/playback-protocol";

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
const TV_PAGE_SIZE = 4;

function televisionPageItems(current: number, total: number): Array<number | "ellipsis"> {
  if (total <= 7) return Array.from({ length: total }, (_, index) => index + 1);
  if (current <= 4) return [1, 2, 3, 4, 5, "ellipsis", total];
  if (current >= total - 3) return [1, "ellipsis", total - 4, total - 3, total - 2, total - 1, total];
  return [1, "ellipsis", current - 1, current, current + 1, "ellipsis", total];
}

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
  const { user, can, logout } = useAuth();
  const { data = emptyTelevisions, isLoading, isFetching, error, refetch } = useGetTelevisionsQuery(undefined, { skip: !can("televisions.view"), refetchOnFocus: true, refetchOnReconnect: true });
  const { socketDevices, onlineTvIds, lowSignalTvIds, hasStatusSnapshot, mediaReadyByTvId, mediaErrorByTvId, latestMediaError, dismissMediaError, mediaControlByTvId, sendAdminCommand, sendPlayback, isSocketConnected, requests, pendingTvIds, connectionError, commandError } = useConnectedTvs();
  // Solo las órdenes que incluyen contenido implican una descarga en la TV.
  // Los controles globales siguen disponibles mientras esa descarga se completa.
  const contentDeliveryPending = Object.values(requests).some((request) =>
    (Boolean(request.command.datos.playlist_id) || Boolean(request.command.datos.contenido_id))
    && Object.values(request.targets).some((target) => target.status === "pending"),
  );
  // Estado optimista local; las confirmaciones posteriores de la TV tienen prioridad.
  const [overrides, setOverrides] = useState<Record<string, Partial<Television>>>({});
  const sourceDevices = error ? emptyTelevisions : data;
  const [broadcastSource, setBroadcastSource] = useState<PlaybackSelection | null>(null);
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
        ...(mediaControl?.shuffle !== undefined ? { shuffle: mediaControl.shuffle } : {}),
        ...(mediaControl?.contentId !== undefined ? { currentContentId: mediaControl.contentId, playlistId: undefined, currentContentUrl: `/api/contenidos/${encodeURIComponent(mediaControl.contentId)}/archivo` } : {}),
        ...(mediaControl?.contentType !== undefined ? { contentType: mediaControl.contentType } : {}),
        ...(mediaControl?.playlistId !== undefined ? { playlistId: mediaControl.playlistId, currentContentId: undefined, contentType: undefined, currentContentUrl: undefined } : {}),
        ...(broadcastSource && (mediaControl?.playlistId === broadcastSource.id || mediaControl?.contentId === broadcastSource.id) ? { currentContent: broadcastSource.name } : {}),
        ...(mediaControl?.currentMedia ? { currentContent: mediaControl.currentMedia.name, currentContentId: mediaControl.currentMedia.id, contentType: mediaControl.currentMedia.kind, currentContentUrl: `/api/contenidos/${encodeURIComponent(mediaControl.currentMedia.id)}/archivo` } : {}),
        ...(mediaControl?.playlistId ? { currentContent: mediaControl.playlistName || (broadcastSource?.id === mediaControl.playlistId ? broadcastSource.name : "Playlist") } : {}),
      };

      if (!isOnline) return { ...synchronizedDevice, status: "offline" as const, playbackState: "stopped" as const, connectionStatus: "offline" as const };
      return {
        ...synchronizedDevice,
        status: synchronizedDevice.status === "offline" ? "available" as const : synchronizedDevice.status,
        connectionStatus: isLowSignal ? "low-signal" as const : "online" as const,
      };
    });
  }, [sourceDevices, overrides, onlineTvIds, lowSignalTvIds, hasStatusSnapshot, mediaControlByTvId, broadcastSource]);
  const [registeredPendingIds, setRegisteredPendingIds] = useState<string[]>([]);
  const pendingDevices = (socketDevices ?? emptyTelevisions).filter((device) => !registeredPendingIds.includes(device.id));
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [sidebarExpanded, setSidebarExpanded] = useState(true);
  const [deviceToRegister, setDeviceToRegister] = useState<Television | null>(null);
  const [deviceToEdit, setDeviceToEdit] = useState<Television | null>(null);
  const [deviceToDelete, setDeviceToDelete] = useState<Television | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [commandFeedback, setCommandFeedback] = useState<{ error: boolean; text: string } | null>(null);
  const handlePlayback = (action: PlaybackAction, enabled?: boolean, source = broadcastSource) => {
    if (!can("televisions.control")) return false;
    const targets = selectedPlaybackTargets(devices, selectedIds);
    const result = sendPlayback(action, targets, source, enabled);
    setCommandFeedback(result.error ? { error: true, text: result.error } : null);
    return !result.error;
  };
  const [pendingMediaByDeviceId, setPendingMediaByDeviceId] = useState<Record<string, PendingMediaTransfer>>({});
  const [completedTvCodes, setCompletedTvCodes] = useState<string[]>([]);
  const [query, setQuery] = useState("");
  const [tvPage, setTvPage] = useState(1);
  const selected = devices.find((device) => device.id === selectedId) ?? devices[0];
  const visibleDevices = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase("es");
    return normalized
      ? devices.filter((device) => `${device.room} ${device.name} ${device.tvCode ?? ""} ${device.location ?? ""}`.toLocaleLowerCase("es").includes(normalized))
      : devices;
  }, [devices, query]);
  const tvTotalPages = Math.max(1, Math.ceil(visibleDevices.length / TV_PAGE_SIZE));
  const currentTvPage = Math.min(tvPage, tvTotalPages);
  const pagedDevices = visibleDevices.slice((currentTvPage - 1) * TV_PAGE_SIZE, currentTvPage * TV_PAGE_SIZE);

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

  const assignMedia = (deviceId: string, file: File, kind: "IMAGE" | "VIDEO", contentId?: string) => {
    setOverrides((current) => ({ ...current, [deviceId]: { ...current[deviceId], currentContent: file.name, contentType: kind, ...(contentId ? { currentContentId: contentId } : {}) } }));
    setSelectedId(deviceId);
  };

  const online = devices.filter((device) => device.connectionStatus !== "offline").length;
  const offline = devices.filter((device) => device.connectionStatus === "offline").length;
  return (
    <main className="min-h-screen bg-[#f4f7f5] text-[#17231e] lg:flex">
      <aside className={`relative z-50 hidden min-h-screen shrink-0 flex-col overflow-hidden brand-green-surface py-5 text-white transition-[width,padding] duration-300 lg:sticky lg:top-0 lg:flex lg:h-screen ${sidebarExpanded ? "w-64 px-4" : "w-22 px-3"}`}>
        <SidebarBrand expanded={sidebarExpanded} onToggle={() => setSidebarExpanded((expanded) => !expanded)} />
        <nav className="mt-8 min-h-0 flex-1 space-y-2 overflow-y-auto pr-1" aria-label="Navegación principal">
          <SidebarLink expanded={sidebarExpanded} href="/" label="Inicio" icon={<Home size={20} />} />
          {can("users.manage") && <SidebarLink expanded={sidebarExpanded} href="/usuarios" label="Usuarios" icon={<Users size={20} />} />}
          {can("roles.manage") && <SidebarLink expanded={sidebarExpanded} href="/roles" label="Roles y permisos" icon={<Key size={20} />}/>}
          {can("televisions.view") && <SidebarLink expanded={sidebarExpanded} href="/televisores" label="Televisores" icon={<Monitor size={20} />} />}
          {can("content.view") && <SidebarLink expanded={sidebarExpanded} href="/contenido" label="Contenido" icon={<ImageIcon size={20} />} />}
          {can("playlists.view") && <SidebarLink expanded={sidebarExpanded} href="/listas" label="Playlists" icon={<ListVideo size={20} />} />}
        </nav>
        <nav className="shrink-0 border-t border-white/15 pt-4">
          <button type="button" onClick={() => void logout()} title={sidebarExpanded ? undefined : "Cerrar sesión"} className={`flex h-11 w-full items-center rounded-xl text-white/85 transition hover:bg-white/10 ${sidebarExpanded ? "gap-3 px-4" : "justify-center px-0"}`}><LogOut size={19} />{sidebarExpanded && <span>Cerrar sesión</span>}</button>
          {sidebarExpanded && <div className="mt-3 truncate px-2 text-xs text-white/60">{user?.name ?? "Cargando usuario…"}</div>}
        </nav>
      </aside>
      <div className="flex min-h-screen min-w-0 flex-1 flex-col">
      <AppHeader notificationContent={(appBarScrolled) => <>
          {can("televisions.register") && <button type="button" onClick={() => setNotificationsOpen((open) => !open)} className={`relative grid size-11 cursor-pointer place-items-center rounded-full border-0 bg-transparent transition ${appBarScrolled ? "text-white hover:bg-white/12" : "text-[#173d31] hover:bg-[#edf4f1]"}`} aria-expanded={notificationsOpen} aria-label={`${pendingDevices.length} dispositivos pendientes de registro`}>
            <Bell size={21} />{pendingDevices.length > 0 && <i className="absolute right-1 top-1 size-2.5 rounded-full bg-[#f2b329] ring-2 ring-white" />}
          </button>}
          {can("televisions.register") && notificationsOpen &&
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
        </>} />

      <section id="resumen" className="flex flex-col gap-5 px-5 py-6 md:px-9 xl:flex-row xl:items-center xl:justify-between" aria-label="Resumen de dispositivos">
        <span><h1 className="text-3xl font-extrabold tracking-[-1px] text-[#10241d] md:text-4xl">Todo listo para transmitir</h1><p className="mt-1 text-[#647a72]">Administra los videos e imágenes de tus televisores.</p></span>
        <div className="flex flex-wrap gap-2.5">
          <MiniMetric label="Televisores" value={devices.length} tone="navy" icon={<Monitor size={18} />} />
          <MiniMetric label="En línea" value={online} tone="green" icon={<i className="size-2.5 rounded-full bg-[#13b878]" />} />
          <MiniMetric label="Sin conexión" value={offline} tone="red" icon={<i className="size-2.5 rounded-full bg-[#ef334f]" />} />
        </div>
      </section>

      <div id="televisores" className="grid items-start gap-5 px-5 pb-24 xl:grid-cols-[minmax(0,1fr)_380px] xl:px-9">
        <div className="min-w-0 space-y-5">
          {can("televisions.control") && <GlobalBroadcast
            devices={devices}
            selectedIds={selectedIds}
            onSelectedIdsChange={setSelectedIds}
            selectedSource={broadcastSource}
            socketConnected={isSocketConnected}
            onPlayback={handlePlayback}
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
          />}
          {commandFeedback && <p role="alert" className="rounded-xl bg-[#fff0f0] px-4 py-3 text-sm text-[#b4232c]">{commandFeedback.text}</p>}
          {(connectionError || commandError) && <p role="alert" className="rounded-xl bg-[#fff0f0] px-4 py-3 text-sm text-[#b4232c]">{connectionError ?? commandError}</p>}
          <PlaybackRequestsPanel requests={requests} />
          <section className="min-w-0 rounded-2xl border border-[#e2e6e4] bg-white p-4 shadow-[0_10px_30px_rgba(25,45,38,0.06)] md:p-5">
            <div className="mb-6 flex flex-col gap-4 border-b border-[#d8dddb] pb-5 md:flex-row md:items-center md:justify-between">
              <span>
                <h1 className="my-1 text-[25px] font-semibold">Televisores por sala</h1>
                <p className="m-0 text-[17px] text-[#68696d]">Selecciona un equipo para administrarlo</p>
              </span>
              <label className="flex h-14.5 w-full items-center gap-3 rounded-md border border-[#d6d6d6] bg-white px-4 md:w-72">
                <span className="sr-only">Buscar sala</span>
                <input className="min-w-0 flex-1 border-0 bg-transparent text-[#444] outline-none placeholder:text-[#666]" value={query} onChange={(event) => { setQuery(event.target.value); setTvPage(1); }} placeholder="Buscar sala..." />
                <Search aria-hidden="true" size={18} strokeWidth={1.7} />
              </label>
            </div>
            <div className="grid max-h-155 grid-cols-1 gap-5 overflow-y-auto pb-4 md:grid-cols-2 2xl:grid-cols-3">
              {pagedDevices.map((device) => (
                <DeviceCard key={device.id} device={device} pendingMedia={pendingMediaByDeviceId[device.id]} mediaReady={mediaReadyByTvId[device.tvCode ?? device.id]} mediaError={mediaErrorByTvId[device.tvCode ?? device.id]} commandPending={pendingTvIds.includes(device.tvCode ?? device.id) && Object.values(requests).some(request => request.command.evento !== "media.volume" && request.targets[device.tvCode ?? device.id]?.status === "pending")} volumePending={Object.values(requests).some(request => request.command.evento === "media.volume" && request.targets[device.tvCode ?? device.id]?.status === "pending")} selected={device.id === selected?.id} canControl={can("televisions.control")} canEdit={can("televisions.edit")} canDelete={can("televisions.delete")} canTransfer={can("content.broadcast")} onCommand={sendAdminCommand} onEdit={() => setDeviceToEdit(device)} onDelete={() => setDeviceToDelete(device)} onSelect={() => setSelectedId(device.id)} onMediaDrop={(file, kind, contentId) => assignMedia(device.id, file, kind, contentId)} />
              ))}
              {isLoading && <p role="status">Cargando televisores registrados…</p>}
              {error && <div role="alert"><p>No se pudieron cargar los televisores registrados.</p><button className="mt-3 rounded bg-[#236b5b] px-4 py-2 text-white" disabled={isFetching} onClick={() => refetch()}>Reintentar</button></div>}
              {!isLoading && !error && visibleDevices.length === 0 && <p className="text-[#666970]">{devices.length === 0 ? "No hay televisores registrados." : "No encontramos salas con ese nombre."}</p>}
            </div>
            {!isLoading && !error && visibleDevices.length > 0 && <footer className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-[#e6ebe8] pt-4">
              <p className="text-sm text-[#66736d]">Mostrando <strong>{(currentTvPage - 1) * TV_PAGE_SIZE + 1}</strong>–<strong>{Math.min(currentTvPage * TV_PAGE_SIZE, visibleDevices.length)}</strong> de <strong>{visibleDevices.length}</strong> televisores</p>
              <nav aria-label="Paginación de televisores por sala" className="inline-flex max-w-full flex-wrap items-center overflow-hidden rounded-xl border border-[#d8dfdc]">
                <button type="button" disabled={currentTvPage <= 1 || isFetching} onClick={() => setTvPage(currentTvPage - 1)} aria-label="Página anterior de televisores" className="grid size-10 place-items-center text-[#52625a] hover:bg-[#f0f8f4] disabled:cursor-not-allowed disabled:opacity-40"><ChevronLeft size={18} /></button>
                {televisionPageItems(currentTvPage, tvTotalPages).map((item, index) => item === "ellipsis" ? <span key={"ellipsis-" + index} className="grid size-10 place-items-center text-[#718079]">…</span> : <button type="button" key={item} disabled={isFetching} onClick={() => setTvPage(item)} aria-label={"Ir a la página " + item + " de televisores"} aria-current={currentTvPage === item ? "page" : undefined} className={"grid size-10 place-items-center border-l border-[#d8dfdc] text-sm font-semibold disabled:opacity-50 " + (currentTvPage === item ? "bg-[#08783f] text-white" : "text-[#52625a] hover:bg-[#f0f8f4]")}>{item}</button>)}
                <button type="button" disabled={currentTvPage >= tvTotalPages || isFetching} onClick={() => setTvPage(currentTvPage + 1)} aria-label="Página siguiente de televisores" className="grid size-10 place-items-center border-l border-[#d8dfdc] text-[#52625a] hover:bg-[#f0f8f4] disabled:cursor-not-allowed disabled:opacity-40"><ChevronRight size={18} /></button>
              </nav>
            </footer>}
          </section>
        </div>
        <DashboardLibraryPanel selectedTvCount={selectedPlaybackTargets(devices, selectedIds).length} socketConnected={isSocketConnected} sendPending={contentDeliveryPending} onSelectionChange={setBroadcastSource} onSend={(source) => handlePlayback("prepare", undefined, source)} />
      </div>
      {deviceToRegister && <RegisterDeviceDialog device={deviceToRegister} onCancel={() => setDeviceToRegister(null)} onRegistered={() => { setRegisteredPendingIds((current) => [...current, deviceToRegister.id]); setDeviceToRegister(null); }} />}
      {deviceToEdit && <EditDeviceDialog device={deviceToEdit} onClose={() => setDeviceToEdit(null)} />}
      {deviceToDelete && <DeleteDeviceDialog device={deviceToDelete} onClose={() => setDeviceToDelete(null)} onDeleted={() => { setDeviceToDelete(null); setSelectedIds((current) => current.filter((id) => id !== deviceToDelete.id)); if (selectedId === deviceToDelete.id) setSelectedId(null); }} />}
      {latestMediaError && <MediaErrorDialog error={latestMediaError} onClose={dismissMediaError} />}
      {completedTvCodes[0] && <div className="pointer-events-none fixed inset-x-4 bottom-6 z-80 flex justify-center"><div role="status" aria-live="polite" className="tv-snackbar flex w-full max-w-md items-center gap-3 rounded-xl bg-[#173f35] px-4 py-3 text-white shadow-[0_14px_40px_rgba(10,45,33,0.32)]"><span className="grid size-9 shrink-0 place-items-center rounded-full bg-[#20ad78] text-white"><Check size={19} /></span><span className="min-w-0"><strong className="block text-sm">TV lista para reproducir</strong><small className="block truncate text-white/80">{completedTvCodes[0]} terminó de descargar el contenido.</small></span></div></div>}
      <AppFooter />
      </div>
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

export function CurrentTime() {
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

function GlobalBroadcast({ devices, selectedIds, onSelectedIdsChange, selectedSource, socketConnected, onPlayback, mediaReadyByTvId, mediaErrorByTvId, onMediaAssigned }: { devices: Television[]; selectedIds: string[]; onSelectedIdsChange: (ids: string[]) => void; selectedSource: PlaybackSelection | null; socketConnected: boolean; onPlayback: (action: PlaybackAction, enabled?: boolean) => boolean; mediaReadyByTvId: Record<string, MediaReadyState>; mediaErrorByTvId: Record<string, MediaErrorState>; onMediaAssigned: (devices: Television[], file: File, kind: "IMAGE" | "VIDEO", readyBaselines: Record<string, number>, errorBaselines: Record<string, number>) => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewExpanded, setPreviewExpanded] = useState(false);
  const [confirmation, setConfirmation] = useState<{ target: "all" | "selected"; devices: Television[] } | null>(null);
  const [completed, setCompleted] = useState(0);
  const [activeTargetCount, setActiveTargetCount] = useState(0);
  const [tvSelectorOpen, setTvSelectorOpen] = useState(false);

  const { transferToMany, resetTransfer, progress, isUploading, error } = useMediaTransfer();
  const onlineDevices = devices.filter((device) => device.connectionStatus !== "offline");
  const selectedDevices = onlineDevices.filter((device) => selectedIds.includes(device.id));
  const allSelected = onlineDevices.length > 0 && selectedDevices.length === onlineDevices.length;
  const partiallySelected = selectedDevices.length > 0 && !allSelected;
  const groupRepeat = selectedDevices.length > 0 && selectedDevices.every((device) => device.repeat);
  const groupShuffle = selectedDevices.length > 0 && selectedDevices.every((device) => device.shuffle);
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

  const toggleTv = (device: Television) => {
    if (device.connectionStatus === "offline") return;
    onSelectedIdsChange(selectedIds.includes(device.id) ? selectedIds.filter((id) => id !== device.id) : [...selectedIds, device.id]);
  };


  return (
    <section id="transmision-general" className="@container rounded-2xl border border-[#dfe5e2] bg-white p-5 shadow-[0_12px_35px_rgba(23,48,39,0.07)] md:p-6">
      <div className="mb-5 grid grid-cols-1 items-center gap-3 @min-[44rem]:grid-cols-[minmax(0,1fr)_auto]">
        <div className="flex flex-wrap items-center gap-3"><h2 className="flex items-center gap-2 text-2xl font-semibold"><Radio className="shrink-0 text-[#179a62]" /> Transmisión general</h2></div>
        <div className="relative flex flex-wrap items-center gap-2 @min-[44rem]:justify-end">
          <span className="rounded-full bg-[#e9f7f0] px-3 py-1.5 text-sm font-semibold text-[#16734f]">{onlineDevices.length} TV en línea</span>
          <button type="button" aria-haspopup="listbox" aria-expanded={tvSelectorOpen} onClick={() => setTvSelectorOpen((open) => !open)} className="flex h-10 items-center gap-2 rounded-xl border border-[#cfdcd6] bg-white px-3.5 text-sm font-semibold text-[#24463a] shadow-sm transition hover:border-[#8db9a6] hover:bg-[#f7fbf9]">
            <Monitor size={17} className="text-[#08783f]" />
            {selectedDevices.length} {selectedDevices.length === 1 ? "pantalla seleccionada" : "pantallas seleccionadas"}
            <ChevronDown size={16} className={`transition-transform ${tvSelectorOpen ? "rotate-180" : ""}`} />
          </button>
          {tvSelectorOpen && <div className="absolute left-0 top-full z-40 mt-2 w-[min(360px,calc(100vw-2.5rem))] @min-[44rem]:right-0 @min-[44rem]:left-auto overflow-hidden rounded-2xl border border-[#d9e3de] bg-white shadow-[0_18px_50px_rgba(19,54,42,.18)]">
            <div className="flex items-center justify-between border-b border-[#e5ebe8] px-4 py-3"><span><strong className="block text-sm">Seleccionar televisores</strong><small className="text-[#718079]">Solo se enviará a equipos en línea.</small></span></div>
            <ul role="listbox" aria-multiselectable="true" aria-label="Televisores disponibles" className="max-h-64 overflow-y-auto p-2">
              <li className="mb-1 border-b border-[#e5ebe8] pb-1"><button type="button" role="option" aria-selected={allSelected} disabled={onlineDevices.length === 0 || !socketConnected} onClick={() => onSelectedIdsChange(allSelected ? [] : onlineDevices.map((device) => device.id))} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left font-semibold text-[#24463a] transition hover:bg-[#f1f7f4] disabled:cursor-not-allowed disabled:opacity-50"><span className={`grid size-5 shrink-0 place-items-center rounded-md border ${allSelected || partiallySelected ? "border-[#08783f] bg-[#08783f] text-white" : "border-[#acbbb4] bg-white"}`}>{allSelected ? <Check size={14} /> : partiallySelected ? <span className="h-0.5 w-2.5 bg-white" /> : null}</span><span>Seleccionar todos</span></button></li>
              {devices.map((device) => { const offline = device.connectionStatus === "offline"; const checked = selectedIds.includes(device.id) && !offline; return <li key={device.id}><button type="button" role="option" aria-selected={checked} disabled={offline} onClick={() => toggleTv(device)} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition hover:bg-[#f1f7f4] disabled:cursor-not-allowed disabled:opacity-50"><span className={`grid size-5 shrink-0 place-items-center rounded-md border ${checked ? "border-[#08783f] bg-[#08783f] text-white" : "border-[#acbbb4] bg-white"}`}>{checked && <Check size={14} />}</span><span className="min-w-0 flex-1"><strong className="block truncate text-sm">{device.name}</strong><small className="block truncate text-[#718079]">{device.room}{device.location ? ` · ${device.location}` : ""}</small></span><span className={`size-2.5 shrink-0 rounded-full ${offline ? "bg-[#e1394d]" : "bg-[#18ad76]"}`} /></button></li>; })}
              {devices.length === 0 && <li className="px-3 py-8 text-center text-sm text-[#718079]">No hay televisores registrados.</li>}
            </ul>
            <div className="flex items-center justify-between border-t border-[#e5ebe8] bg-[#fafcfb] px-4 py-3"><button type="button" onClick={() => onSelectedIdsChange([])} className="text-xs font-semibold text-[#68766f] hover:text-[#b3353e]">Limpiar selección</button><button type="button" onClick={() => setTvSelectorOpen(false)} className="rounded-lg bg-[#08783f] px-4 py-2 text-xs font-semibold text-white">Listo</button></div>
          </div>}
        </div>
        <p className="text-[#6b7073] @min-[44rem]:col-span-2">Controla al mismo tiempo los televisores que selecciones.</p>
      </div>

      {selectedDevices.length > 0 ? <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 2xl:grid-cols-3">
        {selectedDevices.map((device) => <article key={device.id} className="group relative overflow-hidden rounded-2xl border border-[#dce6e1] bg-[#fbfdfc] p-3.5 transition hover:border-[#8fc3ab] hover:shadow-[0_10px_24px_rgba(20,74,53,.08)]">
          <button type="button" onClick={() => toggleTv(device)} aria-label={`Quitar ${device.name} de la selección`} className="absolute right-2.5 top-2.5 grid size-7 place-items-center rounded-full text-[#75837d] transition hover:bg-[#ffe9ea] hover:text-[#c43640]"><X size={15} /></button>
          <div className="flex items-center gap-3 pr-7"><span className="grid size-11 shrink-0 place-items-center rounded-xl bg-[#e4f3ec] text-[#08783f]"><Monitor size={22} /></span><span className="min-w-0 flex-1"><strong className="block truncate text-sm">{device.name}</strong><small className="block truncate text-[#718079]">{device.room}{device.location ? ` · ${device.location}` : ""}</small></span></div>
          <div className="mt-3 flex items-center gap-3 rounded-xl bg-[#f0f5f2] p-2.5"><span className={`grid size-10 shrink-0 place-items-center rounded-lg ${device.contentType === "IMAGE" ? "bg-[#dcefe7] text-[#08783f]" : "bg-[#123e32] text-white"}`}>{device.contentType === "IMAGE" ? <ImageIcon size={20} /> : <MonitorPlay size={20} />}</span><span className="min-w-0 flex-1"><small className="block text-[11px] uppercase tracking-wide text-[#7c8983]">Contenido actual</small><strong className="block truncate text-xs">{device.currentContent || "Sin reproducción"}</strong></span></div>
        </article>)}
      </div> : <div className="grid min-h-42 place-items-center px-5 text-center"><span><span className="mx-auto grid size-12 place-items-center rounded-2xl bg-[#e8f3ee] text-[#08783f]"><Monitor size={24} /></span><strong className="mt-3 block">Selecciona los televisores</strong><small className="mt-1 block text-[#718079]">Usa el selector superior para agregar una, dos o más pantallas.</small></span></div>}

      {selectedSource && <p className="mt-4 text-sm text-[#52665c]">Contenido: <strong>{selectedSource.name}</strong></p>}
      <div className="mt-4 flex flex-col gap-3 rounded-2xl border border-[#dfe7e3] bg-[#f8fbf9] p-3 sm:flex-row sm:items-center">
        <button type="button" disabled={selectedDevices.length === 0 || !socketConnected} onClick={() => onPlayback("resume")} title="Reproducir en todos los televisores seleccionados" className="flex h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-[#08783f] font-semibold text-white transition hover:bg-[#066734] disabled:cursor-not-allowed disabled:bg-[#a7c4b7]"><Play size={18} fill="currentColor" />Reproducir</button>
        <button type="button" disabled={selectedDevices.length === 0 || !socketConnected} onClick={() => onPlayback("stop")} className="flex h-11 flex-1 items-center justify-center gap-2 rounded-xl border border-[#df7780] bg-white font-semibold text-[#c43d47] transition hover:bg-[#fff0f1] disabled:cursor-not-allowed disabled:opacity-45"><CircleStop size={18} fill="currentColor" />Detener</button>
        <span className="hidden h-8 w-px bg-[#d5dfda] sm:block" />
        <button type="button" aria-pressed={groupShuffle} disabled={selectedDevices.length === 0 || !socketConnected} onClick={() => onPlayback("shuffle", !groupShuffle)} className={`flex h-11 flex-1 items-center justify-center gap-2 rounded-xl border font-semibold transition disabled:cursor-not-allowed disabled:opacity-45 ${groupShuffle ? "border-[#08783f] bg-[#e5f3ec] text-[#075f45]" : "border-transparent text-[#405149] hover:bg-[#edf4f1]"}`}><Shuffle size={18} />Aleatorio<span className={`relative ml-1 h-6 w-11 rounded-full transition ${groupShuffle ? "bg-[#0ba66f]" : "bg-[#c7d1cc]"}`}><i className={`absolute top-1 size-4 rounded-full bg-white shadow transition-all ${groupShuffle ? "left-6" : "left-1"}`} /></span></button>
        <button type="button" aria-pressed={groupRepeat} disabled={selectedDevices.length === 0 || !socketConnected} onClick={() => onPlayback("repeat", !groupRepeat)} className={`flex h-11 flex-1 items-center justify-center gap-2 rounded-xl border font-semibold transition disabled:cursor-not-allowed disabled:opacity-45 ${groupRepeat ? "border-[#08783f] bg-[#e5f3ec] text-[#075f45]" : "border-transparent text-[#405149] hover:bg-[#edf4f1]"}`}><Repeat2 size={18} />Repetir<span className={`relative ml-1 h-6 w-11 rounded-full transition ${groupRepeat ? "bg-[#0ba66f]" : "bg-[#c7d1cc]"}`}><i className={`absolute top-1 size-4 rounded-full bg-white shadow transition-all ${groupRepeat ? "left-6" : "left-1"}`} /></span></button>
      </div>

      <div className="hidden" aria-hidden="true">
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
      </div>
    </section>
  );
}

function SidebarLink({ expanded, href, label, icon, active = false }: { expanded: boolean; href: string; label: string; icon: ReactNode; active?: boolean }) {
  const pathname = usePathname();
  const selected = active || pathname === href;
  return <Link href={href} title={expanded ? undefined : label} aria-label={label} aria-current={selected ? "page" : undefined} className={`flex h-11 shrink-0 items-center rounded-xl transition ${expanded ? "gap-3 px-4" : "justify-center px-0"} ${selected ? "border-l-4 border-[var(--brand-gold)] bg-[var(--brand-green-deep)] font-semibold text-white" : "text-white/85 hover:bg-white/10"}`}><span className="shrink-0">{icon}</span>{expanded && <span className="whitespace-nowrap">{label}</span>}</Link>;
}

function MiniMetric({ label, value, tone, icon }: { label: string; value: number; tone: "navy" | "green" | "red"; icon: ReactNode }) {
  const tones = { navy: "text-[#17304f]", green: "text-[#079563]", red: "text-[#df2941]" };
  return <article className="flex min-h-15 min-w-25 items-center gap-2.5 rounded-xl border border-[#e4e9e6] bg-white px-4 shadow-[0_5px_16px_rgba(27,58,46,0.04)]"><span className={tones[tone]}>{icon}</span><span><strong className={`block text-xl leading-5 ${tones[tone]}`}>{value}</strong><small className="text-[11px] text-[#708078]">{label}</small></span></article>;
}

export function Metric({ label, value, detail, iconColor, borderColor }: { label: string; value: number; detail: string; iconColor: string; borderColor: string }) {
  return (
    <article className={`flex h-26.25 items-center gap-4 rounded-2xl border border-l-4 border-[#e0e5e3] bg-white px-5 py-4 shadow-[0_8px_24px_rgba(35,70,57,0.06)] md:h-28 md:px-6 ${borderColor}`}>
      <span className={`grid size-12 shrink-0 place-items-center rounded-xl text-white ${iconColor}`}><Monitor size={22} /></span>
      <span className="min-w-0"><strong className="block text-[28px] leading-8 text-[#202226]">{value}</strong><span className="block font-semibold text-[#34383a]">{label}</span><small className="block truncate text-sm text-[#7a7e80]">{detail}</small></span>
    </article>
  );
}

function DeviceCard({ device, volumePending, commandPending, pendingMedia, mediaReady, mediaError, selected, canControl, canEdit, canDelete, canTransfer, onCommand, onEdit, onDelete, onSelect, onMediaDrop }: { device: Television; volumePending: boolean; commandPending: boolean; pendingMedia?: PendingMediaTransfer; mediaReady?: MediaReadyState; mediaError?: MediaErrorState; selected: boolean; canControl: boolean; canEdit: boolean; canDelete: boolean; canTransfer: boolean; onCommand: (evento: AdminCommandEvent, datos: Record<string, unknown>) => boolean; onEdit: () => void; onDelete: () => void; onSelect: () => void; onMediaDrop: (file: File, kind: "IMAGE" | "VIDEO", contentId?: string) => void }) {
  const isStandaloneImage = !device.playlistId && device.contentType === "IMAGE";
  const [isDraggingVideo, setIsDraggingVideo] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [awaitingMedia, setAwaitingMedia] = useState<{ baseline: number; errorBaseline: number; file: File; kind: "IMAGE" | "VIDEO" } | null>(null);
  const { transfer, progress, isUploading, error: dropError } = useMediaTransfer();
  const connectionStatus = device.connectionStatus ?? (device.status === "offline" ? "offline" : "online");
  const isWaitingForTv = Boolean(pendingMedia || awaitingMedia);
  const lastContactLabel = device.lastContactAt
    ? new Intl.DateTimeFormat("es-BO", { dateStyle: "short", timeStyle: "short" }).format(new Date(device.lastContactAt))
    : "No disponible";

  const sendQuickCommand = (event: AdminCommandEvent, extra?: Record<string, unknown>) => {
    onCommand(event === "media.show" ? "media.play" : event, { tv_id: device.tvCode ?? device.id, ...extra });
  };

  const toggleVideoPlayback = () => {
    if (!canControl || isStandaloneImage || connectionStatus === "offline" || isWaitingForTv || commandPending) return;
    const playing = device.playbackState === "playing";
    sendQuickCommand(playing ? "media.pause" : "media.play");
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
    if (!canTransfer) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "copy";
    setIsDraggingVideo(true);
  };

  const handleDrop = async (event: DragEvent<HTMLElement>) => {
    if (!canTransfer) return;
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
          {(canEdit || canDelete) && <button type="button" onClick={(event) => { event.stopPropagation(); setMenuOpen((open) => !open); }} aria-label="Abrir acciones del televisor" aria-expanded={menuOpen} className="grid size-8 cursor-pointer place-items-center rounded-full border-0 bg-transparent text-[#69716e] transition hover:bg-[#eef2f0] hover:text-[#202925]"><MoreVertical size={20} /></button>}
          {menuOpen && (canEdit || canDelete) && <div className="absolute right-0 top-9 z-30 w-40 overflow-hidden rounded-xl border border-[#dfe4e2] bg-white p-1.5 shadow-[0_12px_32px_rgba(20,35,29,0.18)]" onClick={(event) => event.stopPropagation()}>
            {canEdit && <button type="button" onClick={() => { setMenuOpen(false); onEdit(); }} className="flex h-10 w-full cursor-pointer items-center gap-2 rounded-lg border-0 bg-white px-3 text-left text-sm font-medium hover:bg-[#f2f6f4]"><Pencil size={16} className="text-[#146be8]" /> Editar</button>}
            {canDelete && <button type="button" onClick={() => { setMenuOpen(false); onDelete(); }} className="flex h-10 w-full cursor-pointer items-center gap-2 rounded-lg border-0 bg-white px-3 text-left text-sm font-medium text-[#c43b42] hover:bg-[#fff0f0]"><Trash2 size={16} className="text-[#c43b42]" /> Eliminar</button>}</div>}
        </span>
      </span>
      <span className={`relative mt-3 flex h-37.5 items-center justify-center overflow-hidden rounded-[14px] bg-[#090c0b] text-white shadow-[0_8px_18px_rgba(0,0,0,0.16)] ${!isStandaloneImage && connectionStatus !== "offline" && !isWaitingForTv ? "cursor-pointer" : ""}`} onClick={(event) => { if (isStandaloneImage) return; event.stopPropagation(); toggleVideoPlayback(); }}>
        <CurrentMediaPoster key={`${device.currentContentId}:${device.contentType}`} device={device} />
        {connectionStatus === "offline" ? (
          <span className="flex flex-col items-center justify-center gap-1.5 text-center text-white/75">
            <MonitorOff aria-hidden="true" size={42} strokeWidth={1.5} />
            <strong className="mt-1 text-sm font-medium text-white/90">Sin señal</strong>
            <small className="text-[11px] text-white/55">Último contacto:</small>
            <small className="text-[11px] text-white/70">{lastContactLabel}</small>
          </span>
        ) : isStandaloneImage
          ? <ImageIcon aria-hidden="true" size={58} strokeWidth={1.7} className="text-[#66706e]" />
          : canControl ? <button type="button" disabled={isWaitingForTv || commandPending} onClick={(event) => { event.stopPropagation(); toggleVideoPlayback(); }} aria-label={device.playbackState === "playing" ? "Pausar video" : "Reproducir video"} aria-pressed={device.playbackState === "playing"} className="grid size-12 cursor-pointer place-items-center rounded-full border border-white/30 bg-black/35 text-white backdrop-blur-sm transition hover:scale-105 hover:bg-black/55 disabled:cursor-not-allowed disabled:opacity-40">{device.playbackState === "playing" ? <Pause size={23} fill="currentColor" /> : <Play size={23} fill="currentColor" />}</button> : <MonitorPlay size={46} className="text-white/35" />}
        {canControl && connectionStatus !== "offline" && !isStandaloneImage && (
          <span className="absolute inset-x-0 bottom-0 bg-linear-to-t from-black/95 via-black/65 to-transparent px-3 pt-8 pb-2.5">
            {/* <span className="mb-2 block h-1 overflow-hidden rounded-full bg-white/35"><i className="block h-full rounded-full bg-[#146be8]" style={{ width: device.playbackState === "playing" ? "42%" : `${Math.min(device.playbackPosition ?? 0, 100)}%` }} /></span> */}
            <span className="flex items-center gap-2 text-[11px] text-white/90">
              {device.playbackState === "playing" ? <Pause size={14} fill="currentColor" /> : <Play size={14} fill="currentColor" />}
              <span>{formatPlaybackTime(device.playbackPosition)} / 00:00</span>
              <TvVolumeControl volume={device.volume} pending={volumePending} disabled={isWaitingForTv || commandPending || !canControl} onCommit={(volume) => onCommand("media.volume", { tv_id: device.tvCode ?? device.id, volumen: volume })} />
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
      {commandPending && <small role="status" className="mt-2 block text-[#146be8]">Orden pendiente de confirmación…</small>}
      {dropError && <small role="alert" className="mt-2 block rounded-lg bg-[#fff0f0] px-3 py-2 text-sm text-[#b4232c]">{dropError}</small>}
      <span className="block pt-3">
        <strong title={device.currentContent} className="block break-words text-sm font-medium">{device.currentContent}</strong>
        <small className="mt-1 flex items-center gap-2 truncate text-[#747b7d]"><i className={`size-2.5 shrink-0 rounded-full ${playbackActivityColor(device)}`} /><span className="truncate">{playbackActivityLabel(device)}</span></small>
      </span>
      {canControl && <div className="relative mt-3 grid grid-cols-2 gap-2 border-t border-[#e8ebe9] pt-3" onClick={(event) => event.stopPropagation()}>
        <button type="button" disabled={connectionStatus === "offline" || isWaitingForTv || commandPending} onClick={() => { const playing = device.playbackState === "playing"; const image = isStandaloneImage; sendQuickCommand(image ? playing ? "media.hide" : "media.show" : playing ? "media.pause" : "media.play"); }} className="flex h-9 items-center justify-center gap-1 rounded-lg border border-[#dce2df] bg-white px-2 text-xs font-medium text-[#303537] disabled:opacity-40">{device.playbackState === "playing" ? <Pause size={18} className="text-[#146be8]" /> : <Play size={18} className="text-[#146be8]" />}{isStandaloneImage ? device.playbackState === "playing" ? "Ocultar" : "Mostrar" : device.playbackState === "playing" ? "Pausar" : "Play"}</button>
        <button type="button" disabled={connectionStatus === "offline" || isWaitingForTv} onClick={() => sendQuickCommand("media.stop")} className="flex h-9 items-center justify-center gap-1 rounded-lg border border-[#dce2df] bg-white px-2 text-xs font-medium text-[#303537] disabled:opacity-40"><CircleStop size={18} className="text-[#d23f47]" />Detener</button>
        <button type="button" disabled={connectionStatus === "offline" || isWaitingForTv || commandPending || (!device.currentContentId && !device.playlistId)} aria-pressed={Boolean(device.repeat)} onClick={() => { const repetir = !device.repeat; sendQuickCommand("media.repeat", { repetir }); }} className={"flex h-9 items-center justify-center gap-1 rounded-lg border px-2 text-xs font-semibold disabled:opacity-40 " + (device.repeat ? "border-[#08783f] bg-[#08783f] text-white" : "border-[#dce2df] bg-white text-[#303537] hover:bg-[#f2f6fb]")}><Repeat2 size={18} />Repetir</button>
        <button type="button" disabled={connectionStatus === "offline" || isWaitingForTv || commandPending || (!device.currentContentId && !device.playlistId)} aria-pressed={Boolean(device.shuffle)} onClick={() => { const aleatorio = !device.shuffle; sendQuickCommand("media.shuffle", { aleatorio }); }} className={"flex h-9 items-center justify-center gap-1 rounded-lg border px-2 text-xs font-semibold disabled:opacity-40 " + (device.shuffle ? "border-[#08783f] bg-[#08783f] text-white" : "border-[#dce2df] bg-white text-[#303537] hover:bg-[#f2f6fb]")}><Shuffle size={18} />Aleatorio</button>
      </div>}
    </article>
  );
}

export function ControlPanel({ device, isMediaPending, mediaReady, mediaError, onCommand }: { device: Television; isMediaPending: boolean; mediaReady?: MediaReadyState; mediaError?: MediaErrorState; onCommand: (evento: AdminCommandEvent, datos: Record<string, unknown>) => boolean;  }) {
  const [commandError, setCommandError] = useState<string | null>(null);
  const connectionStatus = device.connectionStatus ?? (device.status === "offline" ? "offline" : "online");
  const indicatorStyle = connectionStatus === "online" ? statusStyles[device.status] : connectionStyles[connectionStatus];
  const playbackLabel = device.playbackState === "paused" ? "Pausado" : device.playbackState === "stopped" ? "Detenido" : device.playbackState === "playing" ? "Reproduciendo" : "Listo";
  const isImage = !device.playlistId && device.contentType === "IMAGE";
  const isImageVisible = isImage && device.playbackState === "playing";
  const tvId = device.tvCode ?? device.id;
  const transferReady = Boolean(mediaReady || device.currentContentId || device.currentContent !== "Sin reproducción");
  const lastContact = device.lastContactAt ? new Intl.DateTimeFormat("es-BO", { dateStyle: "short", timeStyle: "short" }).format(new Date(device.lastContactAt)) : "No disponible";

  const sendCommand = (evento: AdminCommandEvent, extra?: Record<string, unknown>) => {
    const sent = onCommand(evento === "media.show" ? "media.play" : evento, { tv_id: tvId, ...extra });
    if (!sent) return setCommandError("No se pudo enviar la orden porque Socket.IO está desconectado.");
    setCommandError(null);
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
          {isImage ? <button type="button" disabled={connectionStatus === "offline" || isMediaPending} onClick={() => sendCommand(isImageVisible ? "media.hide" : "media.show")} className="flex h-9 flex-1 cursor-pointer items-center justify-center gap-2 rounded-lg border border-[#dce2df] bg-white text-sm font-semibold disabled:opacity-40">{isImageVisible ? <EyeOff size={16} /> : <ImageIcon size={16} />}{isImageVisible ? "Ocultar" : "Mostrar"}</button> : <><button type="button" disabled={connectionStatus === "offline" || isMediaPending} onClick={() => sendCommand(device.playbackState === "playing" ? "media.pause" : "media.play")} className="flex h-9 flex-1 cursor-pointer items-center justify-center gap-2 rounded-lg border border-[#dce2df] bg-white text-sm font-semibold disabled:opacity-40">{device.playbackState === "playing" ? <Pause size={16} /> : <Play size={16} />}{device.playbackState === "playing" ? "Pausar" : "Reproducir"}</button><button type="button" disabled={connectionStatus === "offline" || isMediaPending} onClick={() => sendCommand("media.stop")} className="grid size-9 cursor-pointer place-items-center rounded-lg border border-[#dce2df] bg-white disabled:opacity-40"><CircleStop size={16} /></button></>}
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

function CurrentMediaPoster({ device }: { device: Television }) {
  const [failed, setFailed] = useState(false);
  const url = device.currentContentId ? `/api/contenidos/${encodeURIComponent(device.currentContentId)}/archivo` : undefined;
  if (!url || failed) return null;
  return <span className="pointer-events-none absolute inset-0" aria-hidden="true">{device.contentType === "IMAGE" ? <Image src={url} alt="" fill unoptimized onError={() => setFailed(true)} className="object-contain" /> : <video src={url + "#t=0.1"} preload="metadata" muted playsInline onError={() => setFailed(true)} className="h-full w-full object-contain" />}</span>;
}
