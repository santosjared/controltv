"use client";

import Image from "next/image";
import Link from "next/link";
import { ArrowUp, Clock3, Globe2, Mail, MapPin, Phone, ShieldAlert } from "lucide-react";
import { useAuth } from "@/features/auth/auth-context";
import type { PermissionKey } from "@/features/access-control/types";
import { FacebookIcon, TikTokIcon, YouTubeIcon } from "./brand-icons";

const systemLinks: { href: string; label: string; permission: PermissionKey }[] = [
  { href: "/", label: "Inicio", permission: "dashboard.view" },
  { href: "/televisores", label: "Televisores", permission: "televisions.view" },
  { href: "/contenido", label: "Contenido multimedia", permission: "content.view" },
  { href: "/listas", label: "Playlists", permission: "playlists.view" },
];

const administrationLinks: { href: string; label: string; permission: PermissionKey }[] = [
  { href: "/usuarios", label: "Usuarios", permission: "users.manage" },
  { href: "/roles", label: "Roles y permisos", permission: "roles.manage" },
];

export function AppFooter() {
  const { can } = useAuth();
  const visibleSystemLinks = systemLinks.filter(({ permission }) => can(permission));
  const visibleAdministrationLinks = administrationLinks.filter(({ permission }) => can(permission));

  return (
    <footer className="mt-auto text-white">
      <div className="overflow-hidden bg-(--brand-emergency) py-3 text-sm font-extrabold uppercase tracking-[0.16em]" aria-label="Información de emergencia">
        <div className="emergency-ticker flex w-max items-center whitespace-nowrap">
          {[0, 1].map((copy) => (
            <span key={copy} className="flex items-center gap-10 pr-10" aria-hidden={copy === 1}>
              <span>Emergencias: <b className="text-(--brand-gold)">168</b></span>
              <span>Teléfono hospital: <b className="text-(--brand-gold)">(2) 6244960</b></span>
              <span>Atención inmediata ante urgencias médicas</span>
              <span className="flex items-center gap-2"><ShieldAlert size={18} className="text-(--brand-gold)" /> Emergencias 24 horas</span>
            </span>
          ))}
        </div>
      </div>

      <div className="brand-green-surface px-6 pb-6 pt-12 md:px-10 xl:px-14">
        <div className="mx-auto grid max-w-7xl gap-10 md:grid-cols-2 xl:grid-cols-[1.35fr_0.8fr_0.8fr_1.25fr]">
          <section>
            <div className="flex items-center gap-4">
              <span className="grid size-20 shrink-0 place-items-center rounded-2xl bg-white p-2 shadow-sm"><Image src="/logo-completo.svg" alt="Hospital Daniel Bracamonte" width={66} height={66} /></span>
              <span><small className="block font-extrabold uppercase text-xs tracking-[0.18em] text-(--brand-gold)">Hospital de tercer nivel</small><strong className="mt-1 block text-xl">Daniel Bracamonte</strong></span>
            </div>
            <p className="mt-5 max-w-sm text-sm leading-6 text-white/78">Calidad y calidez al servicio de la salud potosina.</p>
            <div className="mt-5 h-1 w-24 rounded-full bg-(--brand-gold)" />
            <p className="mt-5 text-xs font-bold uppercase tracking-[0.16em] text-white/60">Canales oficiales</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <a href="https://hospitaldanielbracamonte.org.bo" target="_blank" rel="noreferrer" className="inline-flex h-8 items-center gap-1.5 rounded-full bg-white/12 px-3 text-xs font-bold text-white transition hover:-translate-y-0.5 hover:bg-(--brand-gold) hover:text-[#075f45]"><Globe2 size={16} /> Sitio web</a>
              <a href="https://www.facebook.com/profile.php?id=100063500984665" target="_blank" rel="noreferrer" aria-label="Facebook" className="group inline-flex h-8 items-center gap-1.5 rounded-full bg-white/12 px-3 text-xs font-bold text-white transition hover:-translate-y-0.5 hover:bg-(--brand-gold) hover:text-[#075f45]"><FacebookIcon className="size-4.5" /> Facebook</a>
              <a href="https://www.youtube.com/@DANIELBRACAMONTEHOSPITAL" target="_blank" rel="noreferrer" aria-label="YouTube" className="group inline-flex h-8 items-center gap-1.5 rounded-full bg-white/12 px-3 text-xs font-bold text-white transition hover:-translate-y-0.5 hover:bg-(--brand-gold) hover:text-[#075f45]"><YouTubeIcon className="size-4.5" /> YouTube</a>
              <a href="https://www.tiktok.com/@hospitaldanielbracamont" target="_blank" rel="noreferrer" aria-label="TikTok" className="inline-flex h-8 items-center gap-1.5 rounded-full bg-white/12 px-3 text-xs font-bold text-white transition hover:-translate-y-0.5 hover:bg-(--brand-gold) hover:text-[#075f45]"><TikTokIcon className="size-4" /> TikTok</a>
            </div>
          </section>

          <FooterLinks title="Enlaces" links={visibleSystemLinks} />
          <FooterLinks title="Administración" links={visibleAdministrationLinks} emptyLabel="Sin accesos administrativos" />

          <section>
            <FooterTitle>Contacto</FooterTitle>
            <ul className="mt-5 space-y-4 text-sm text-white/82">
              <li className="flex gap-3"><MapPin size={19} className="mt-0.5 shrink-0 text-(--brand-gold)" /><span>Final Avenida Italia s/n,<br />Potosí, Bolivia</span></li>
              <li className="flex gap-3"><Phone size={19} className="shrink-0 text-(--brand-gold)" /><span><b>(2) 6244960</b><br /><strong className="text-(--brand-gold)">Emergencias: 168</strong></span></li>
              <li className="flex gap-3"><Mail size={19} className="shrink-0 text-(--brand-gold)" /><a className="break-all hover:text-white" href="mailto:hospitaldanielbracamonte@gmail.com">hospitaldanielbracamonte@gmail.com</a></li>
              <li className="flex gap-3"><Clock3 size={19} className="shrink-0 text-(--brand-gold)" /><span>Emergencias: 24 horas<br />Consulta externa: según programación</span></li>
            </ul>
          </section>
        </div>

        <div className="relative mx-auto mt-10 grid max-w-7xl place-items-center border-t border-white/15 pt-6 text-center text-sm text-white/65 md:min-h-17 md:px-16">
          <span className="flex flex-col items-center gap-1.5">
            <span>© 2026 Hospital de Tercer Nivel “Daniel Bracamonte”.</span>
            <strong className="font-semibold text-white/75">TV Master · Unidad de Informática y Sistemas</strong>
          </span>
          <button type="button" onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })} aria-label="Volver al inicio de la página" title="Volver arriba" className="mt-5 grid size-11 cursor-pointer place-items-center rounded-full border border-white/35 bg-transparent text-white transition hover:border-(--brand-gold) hover:bg-(--brand-gold) hover:text-[#075f45] md:absolute md:right-0 md:top-5 md:mt-0"><ArrowUp size={21} /></button>
        </div>
      </div>
    </footer>
  );
}

function FooterTitle({ children }: { children: string }) {
  return <h2 className="text-sm font-extrabold uppercase tracking-[0.2em] text-(--brand-gold)">{children}</h2>;
}

function FooterLinks({ title, links, emptyLabel }: { title: string; links: { href: string; label: string }[]; emptyLabel?: string }) {
  return <section><FooterTitle>{title}</FooterTitle>{links.length > 0 ? <nav className="mt-5 flex flex-col items-start gap-3" aria-label={title}>{links.map((link) => <Link key={link.href} href={link.href} className="text-sm font-medium text-white/78 transition hover:translate-x-1 hover:text-white">{link.label}</Link>)}</nav> : <p className="mt-5 text-sm text-white/55">{emptyLabel}</p>}</section>;
}
