"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, ImageIcon, Key, ListVideo, LogOut, Monitor, Users } from "lucide-react";
import { useState, type ReactNode } from "react";
import { AppFooter } from "@/components/app-footer";
import { AppHeader } from "@/components/app-header";
import { SidebarBrand } from "@/components/sidebar-brand";
import { useAuth } from "@/features/auth/auth-context";
import type { PermissionKey } from "../types";

type Section = "users" | "roles" | "content" | "playlists" | "televisions";
const sectionRoutes: Record<Section, string> = { users: "/usuarios", roles: "/roles", content: "/contenido", playlists: "/listas", televisions: "/televisores" };
const navigation: { href: string; label: string; icon: typeof Home; permission: PermissionKey }[] = [
  { href: "/", label: "Inicio", icon: Home, permission: "dashboard.view" },
  { href: "/usuarios", label: "Usuarios", icon: Users, permission: "users.manage" },
  { href: "/roles", label: "Roles y permisos", icon: Key, permission: "roles.manage" },
  { href: "/televisores", label: "Televisores", icon: Monitor, permission: "televisions.view" },
  { href: "/contenido", label: "Contenido", icon: ImageIcon, permission: "content.view" },
  { href: "/listas", label: "Playlists", icon: ListVideo, permission: "playlists.view" },
];

export function ManagementShell({ active, title, subtitle, children }: { active: Section; title: string; subtitle: string; children: ReactNode }) {
  const pathname = usePathname();
  const { user, can, logout } = useAuth();
  const [sidebarExpanded, setSidebarExpanded] = useState(true);
  const selectedPath = pathname || sectionRoutes[active];

  const itemClass = (selected: boolean) => `flex min-h-11 shrink-0 items-center rounded-xl py-2.5 transition ${sidebarExpanded ? "gap-3 px-4" : "justify-center px-2"} ${selected ? "border-l-4 border-[var(--brand-gold)] bg-[var(--brand-green-deep)] font-semibold text-white" : "text-white/80 hover:bg-white/10 hover:text-white"}`;

  return (
    <main className="min-h-screen bg-[#f4f7f5] text-[#17231e] lg:flex">
      <aside className={`hidden h-screen shrink-0 flex-col overflow-y-auto brand-green-surface py-5 text-white transition-[width,padding] duration-300 lg:sticky lg:top-0 lg:flex ${sidebarExpanded ? "w-64 px-4" : "w-22 px-3"}`}>
        <SidebarBrand expanded={sidebarExpanded} onToggle={() => setSidebarExpanded((expanded) => !expanded)} />
        <nav className="mt-8 shrink-0 space-y-2" aria-label="Navegación principal">
          {navigation.filter(({ permission }) => can(permission)).map(({ href, label, icon: Icon }) => <Link key={href} href={href} title={!sidebarExpanded ? label : undefined} aria-current={selectedPath === href ? "page" : undefined} className={itemClass(selectedPath === href)}><Icon size={20} className="shrink-0" />{sidebarExpanded && <span>{label}</span>}</Link>)}
        </nav>
        <nav className="mt-auto shrink-0 border-t border-white/15 pt-4">
          <button type="button" onClick={() => void logout()} title={!sidebarExpanded ? "Cerrar sesión" : undefined} className={`${itemClass(false)} w-full cursor-pointer`}><LogOut size={19} />{sidebarExpanded && <span>Cerrar sesión</span>}</button>
          {sidebarExpanded && <p className="mt-3 truncate px-4 text-xs text-white/55">{user?.name ?? "Cargando usuario…"}</p>}
        </nav>
      </aside>

      <div className="flex min-h-screen min-w-0 flex-1 flex-col">
        <AppHeader />
        <section className="flex-1 px-5 py-7 md:px-8"><div className="mb-6"><h1 className="text-3xl font-extrabold tracking-[-.7px]">{title}</h1><p className="mt-1 text-[#687a73]">{subtitle}</p></div>{children}</section>
        <AppFooter />
      </div>
    </main>
  );
}
