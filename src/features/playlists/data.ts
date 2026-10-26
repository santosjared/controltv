export type PlaylistItem = {
  id: string;
  name: string;
  type: "VIDEO" | "IMAGE";
  duration: number;
};

export type Playlist = {
  id: string;
  name: string;
  description: string;
  items: PlaylistItem[];
  updatedAt: string;
};

export const catalog: PlaylistItem[] = [
  { id: "content-1", name: "Bienvenida.mp4", type: "VIDEO", duration: 150 },
  { id: "content-2", name: "Nuestros servicios.png", type: "IMAGE", duration: 12 },
  { id: "content-3", name: "Orientación al paciente.mp4", type: "VIDEO", duration: 45 },
  { id: "content-4", name: "Horarios de atención.jpg", type: "IMAGE", duration: 10 },
];

export const initialPlaylists: Playlist[] = [
  { id: "playlist-1", name: "Sala de espera", description: "Información general para pacientes y familiares.", items: catalog.slice(0, 4), updatedAt: "Hoy, 10:32" },
  { id: "playlist-2", name: "Emergencias", description: "Contenido informativo para el área de emergencias.", items: [catalog[0], catalog[3]], updatedAt: "Ayer, 15:20" },
  { id: "playlist-3", name: "Campaña institucional", description: "Videos institucionales y campañas de salud.", items: [catalog[2]], updatedAt: "4 oct., 09:10" },
];
