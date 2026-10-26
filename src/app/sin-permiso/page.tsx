"use client";

import Link from "next/link";
import { ArrowLeft, ShieldX } from "lucide-react";
import { useAuth } from "@/features/auth/auth-context";

export default function AccessDeniedPage() {
  const { user, logout } = useAuth();
  return <main className="grid min-h-screen place-items-center bg-[#f3f7f5] p-5"><section className="w-full max-w-lg rounded-3xl border border-[#dce5e1] bg-white p-8 text-center shadow-[0_20px_60px_rgba(25,55,43,.1)]"><span className="mx-auto grid size-18 place-items-center rounded-full bg-[#fff0f1] text-[#c53c47]"><ShieldX size={34} /></span><h1 className="mt-5 text-3xl font-extrabold">Acceso restringido</h1><p className="mt-3 leading-7 text-[#687972]">El perfil <strong>{user?.roleName ?? "actual"}</strong> no tiene permisos para abrir este módulo. Solicita acceso a un administrador.</p><div className="mt-7 flex flex-col justify-center gap-3 sm:flex-row"><Link href="/" className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-[#08783f] px-5 font-semibold text-white"><ArrowLeft size={18} />Volver al inicio</Link><button onClick={() => void logout()} className="h-11 rounded-xl border border-[#d7dfdb] px-5 font-semibold text-[#506159]">Cambiar de cuenta</button></div></section></main>;
}
