"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bell, Home, ImageIcon, Key, ListVideo, LogOut, Menu, Monitor, Users, X } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { useAuth } from "@/features/auth/auth-context";
import type { PermissionKey } from "@/features/access-control/types";

type AppHeaderProps = {
  notificationContent?: (scrolled: boolean) => ReactNode;
};

const mobileNavigation: { href: string; label: string; icon: typeof Home; permission: PermissionKey }[] = [
  { href: "/", label: "Inicio", icon: Home, permission: "dashboard.view" },
  { href: "/usuarios", label: "Usuarios", icon: Users, permission: "users.manage" },
  { href: "/roles", label: "Roles y permisos", icon: Key, permission: "roles.manage" },
  { href: "/televisores", label: "Televisores", icon: Monitor, permission: "televisions.view" },
  { href: "/contenido", label: "Contenido", icon: ImageIcon, permission: "content.view" },
  { href: "/listas", label: "Playlists", icon: ListVideo, permission: "playlists.view" },
];

export function AppHeader({ notificationContent }: AppHeaderProps) {
  const pathname = usePathname();
  const { user, can, logout } = useAuth();
  const [scrolled, setScrolled] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const accountMenuRef = useRef<HTMLDivElement>(null);
  const initials = user?.name.split(" ").slice(0, 2).map((part) => part[0]).join("").toUpperCase() ?? "CM";

  useEffect(() => {
    const updateAppBar = () => setScrolled(window.scrollY > 24);
    updateAppBar();
    window.addEventListener("scroll", updateAppBar, { passive: true });
    return () => window.removeEventListener("scroll", updateAppBar);
  }, []);

  useEffect(() => {
    if (!accountOpen) return;
    const closeOnOutsideClick = (event: MouseEvent) => {
      if (!accountMenuRef.current?.contains(event.target as Node)) setAccountOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setAccountOpen(false);
    };
    document.addEventListener("mousedown", closeOnOutsideClick);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("mousedown", closeOnOutsideClick);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [accountOpen]);

  return (
    <header id="inicio" className={`sticky top-0 z-40 flex min-h-20 items-center justify-between gap-6 border-b px-5 py-3 transition-[background-color,color,border-color,box-shadow] duration-300 md:px-9 ${scrolled ? "border-[#096b3d] bg-[#08783f] text-white shadow-[0_8px_24px_rgba(3,76,43,0.2)]" : "border-[#e1e8e4] bg-[#f5f6f5] text-[#17231e] shadow-[0_4px_18px_rgba(24,57,44,0.05)]"}`}>
      <div className="flex min-w-0 items-center gap-3">
        <button type="button" onClick={() => setMobileMenuOpen(true)} aria-label="Abrir navegación" aria-expanded={mobileMenuOpen} className={`grid size-10 shrink-0 place-items-center rounded-xl transition lg:hidden ${scrolled ? "text-white hover:bg-white/12" : "text-[#164c3b] hover:bg-[#e7efeb]"}`}><Menu size={24} /></button>
        <span className="min-w-0">
          <strong className={`block truncate text-[22px] leading-tight tracking-[-0.8px] transition-colors md:text-[30px] ${scrolled ? "text-white" : "text-[#063e2f]"}`}>TV Master</strong>
          <small className={`mt-1 block truncate text-[11px] transition-colors sm:text-[13px] ${scrolled ? "text-white/75" : "text-[#71837c]"}`}>Centro de Multimedia</small>
        </span>
      </div>
      <div className="relative flex items-center gap-2.5">
        {notificationContent ? notificationContent(scrolled) : (
          <button type="button" className={`grid size-11 cursor-pointer place-items-center rounded-full border-0 bg-transparent transition ${scrolled ? "text-white hover:bg-white/12" : "text-[#173d31] hover:bg-[#edf4f1]"}`} aria-label="Notificaciones">
            <Bell size={21} />
          </button>
        )}
        <div ref={accountMenuRef} className="relative">
          <button type="button" onClick={() => setAccountOpen((open) => !open)} aria-expanded={accountOpen} aria-haspopup="menu" aria-label="Abrir menú de usuario" title={user?.name ?? "Cuenta de usuario"} className={`grid size-11 cursor-pointer place-items-center rounded-full border text-sm font-bold transition ${accountOpen ? "ring-3 ring-[#f2b329]/35" : ""} ${scrolled ? "border-white/70 bg-white text-[#075f45] hover:bg-white/90" : "border-[#dfe7e3] bg-[#eef2f1] text-[#27634f] hover:border-[#b9cec5] hover:bg-[#e2eae7]"}`}>
            {initials}
          </button>
          {accountOpen && <div role="menu" className="absolute right-0 top-14 z-50 w-70 overflow-hidden rounded-2xl border border-[#dfe5e2] bg-white text-[#17231e] shadow-[0_18px_45px_rgba(18,48,37,0.2)]">
            <div className="flex items-center gap-3 px-4 py-4">
              <span className="grid size-11 shrink-0 place-items-center rounded-full bg-[#e7f5ee] text-sm font-bold text-[#08783f]">{initials}</span>
              <span className="min-w-0"><strong className="block truncate text-sm">{user?.name ?? "Usuario"}</strong><small className="mt-0.5 block truncate text-[#718079]">{user?.roleName ?? "Sin rol asignado"}</small></span>
            </div>
            <div className="border-t border-[#e5e9e7] p-2">
              <button type="button" role="menuitem" onClick={() => { setAccountOpen(false); void logout(); }} className="flex h-11 w-full cursor-pointer items-center gap-3 rounded-xl px-3 text-left text-sm font-semibold text-[#b52e38] transition hover:bg-[#fff0f1]"><LogOut size={18} />Cerrar sesión</button>
            </div>
          </div>}
        </div>
      </div>
      {mobileMenuOpen && <div className="fixed inset-0 z-60 lg:hidden" role="dialog" aria-modal="true" aria-label="Navegación principal">
        <button type="button" className="absolute inset-0 cursor-default bg-black/45 backdrop-blur-[1px]" onClick={() => setMobileMenuOpen(false)} aria-label="Cerrar navegación" />
        <aside className="absolute inset-y-0 left-0 flex w-[min(82vw,310px)] flex-col bg-[#08783f] p-5 text-white shadow-[18px_0_50px_rgba(0,0,0,0.25)]">
          <div className="flex items-center justify-between border-b border-white/15 pb-5">
            <span><strong className="block text-xl">TV Master</strong><small className="text-white/65">Centro de Multimedia</small></span>
            <button type="button" onClick={() => setMobileMenuOpen(false)} className="grid size-10 place-items-center rounded-full text-white/85 transition hover:bg-white/10" aria-label="Cerrar menú"><X size={22} /></button>
          </div>
          <nav className="mt-6 space-y-2">
            {mobileNavigation.filter(({ permission }) => can(permission)).map(({ href, label, icon: Icon }) => {
              const selected = pathname === href;
              return <Link key={href} href={href} onClick={() => setMobileMenuOpen(false)} aria-current={selected ? "page" : undefined} className={`flex h-12 items-center gap-3 rounded-xl px-4 transition ${selected ? "border-l-4 border-[#f2b329] bg-[#055c38] font-semibold text-white" : "text-white/82 hover:bg-white/10 hover:text-white"}`}><Icon size={20} />{label}</Link>;
            })}
          </nav>
          <div className="mt-auto border-t border-white/15 pt-4">
            <button type="button" onClick={() => { setMobileMenuOpen(false); void logout(); }} className="flex h-12 w-full items-center gap-3 rounded-xl px-4 text-white/85 transition hover:bg-white/10 hover:text-white"><LogOut size={20} />Cerrar sesión</button>
            <p className="mt-3 truncate px-4 text-xs text-white/55">{user?.name}</p>
          </div>
        </aside>
      </div>}
    </header>
  );
}
