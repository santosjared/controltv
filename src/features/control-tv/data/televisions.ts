import type { Television } from "../types";

export const televisions: Television[] = [
  { id: "espera", room: "Sala de Espera", name: "TV Espera Principal", ip: "192.168.10.23", signal: 46, status: "playing", currentContent: "Campaña de vacunación", volume: 46 },
  { id: "pediatria", room: "Pediatría", name: "TV Pediatría 02", ip: "192.168.10.24", signal: 30, status: "offline", currentContent: "Sin conexión", volume: 30 },
  { id: "hospitalizacion", room: "Hospitalización", name: "TV Piso 2", ip: "192.168.10.25", signal: 32, status: "playing", currentContent: "Canal institucional", volume: 32 },
  { id: "cafeteria", room: "Cafetería", name: "TV Cafetería", ip: "192.168.10.26", signal: 20, status: "available", currentContent: "Menú y horarios", volume: 20 },
  { id: "urgencias", room: "Urgencias", name: "TV Urgencias", ip: "192.168.10.27", signal: 72, status: "available", currentContent: "Información para pacientes", volume: 40 },
  { id: "laboratorio", room: "Laboratorio", name: "TV Laboratorio", ip: "192.168.10.28", signal: 61, status: "available", currentContent: "Turnos de atención", volume: 35 },
];
