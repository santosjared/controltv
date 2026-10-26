"use client";

import Image from "next/image";
import Link from "next/link";
import { ChevronsLeft, ChevronsRight } from "lucide-react";

export function SidebarBrand({ expanded, onToggle }: { expanded: boolean; onToggle: () => void }) {
  return (
    <div className={`flex h-14 shrink-0 items-center ${expanded ? "gap-2.5 px-2" : "justify-between"}`}>
      <Link href="/" className={`grid shrink-0 place-items-center overflow-hidden rounded-md bg-white/20 transition-[width,height] ${expanded ? "size-12" : "size-9"}`}>
        <Image src="/HB.svg" alt="Hospital Daniel Bracamonte" width={48} height={48} className="size-full object-contain" />
      </Link>
      {expanded && (
        <span className="min-w-0 flex-1 leading-tight">
          <strong className="block whitespace-nowrap text-[17px]">TV Master</strong>
          <small className="mt-0.5 block max-w-31 text-[11px] leading-3.5 text-white/70">Hospital Daniel Bracamonte</small>
        </span>
      )}
      <button type="button" onClick={onToggle} aria-label={expanded ? "Contraer menú lateral" : "Expandir menú lateral"} title={expanded ? "Contraer menú" : "Expandir menú"} className="ml-auto grid size-7 shrink-0 cursor-pointer place-items-center rounded-md border-0 bg-transparent text-white/65 transition hover:bg-white/10 hover:text-white">
        {expanded ? <ChevronsLeft size={21} strokeWidth={2.2} /> : <ChevronsRight size={21} strokeWidth={2.2} />}
      </button>
    </div>
  );
}
