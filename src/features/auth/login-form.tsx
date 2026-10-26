"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Eye, EyeOff, LockKeyhole, LogIn, User } from "lucide-react";
import { useAuth } from "./auth-context";
import type { AuthUser } from "./auth-config";

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { acceptSession } = useAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password, remember }),
      });
      const payload = await response.json() as { message?: string; user?: AuthUser };
      if (!response.ok) {
        setError(payload.message ?? "No se pudo iniciar sesión.");
        return;
      }
      if (!payload.user) {
        setError("El servidor no devolvió los datos de la sesión.");
        return;
      }
      acceptSession(payload.user);
      const next = searchParams.get("next");
      router.replace(next?.startsWith("/") ? next : "/");
      router.refresh();
    } catch {
      setError("No se pudo conectar con el servicio de autenticación.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#003d31] p-4 text-[#162b24] sm:p-7 lg:p-10">
      <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: "linear-gradient(115deg, rgba(0,77,42,.91), rgba(0,77,42,.73) 42%, rgba(15,23,42,.84)), url('/hospital-login-bg.jpg')" }} />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_20%,rgba(18,158,82,.18),transparent_36%)]" />

      <section className="relative mx-auto grid min-h-[calc(100vh-2rem)] max-w-7xl overflow-hidden rounded-[34px] border border-white/20 bg-white/4 shadow-[0_30px_90px_rgba(0,0,0,.28)] sm:min-h-[calc(100vh-3.5rem)] lg:grid-cols-[1fr_0.9fr]">
        <div className="relative hidden items-center justify-center p-10 lg:flex">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(9,135,74,.28),transparent_58%)]" />
          <div className="relative">
            <div className="absolute inset-5 rounded-full bg-[#0b9d52]/30 blur-3xl" />
            <div className="relative grid size-[clamp(330px,34vw,470px)] place-items-center rounded-full border-14 border-white/75 bg-white shadow-[0_26px_70px_rgba(0,0,0,.32)] ring-2 ring-white/65">
              <div className="size-[86%] bg-contain bg-center bg-no-repeat" style={{ backgroundImage: "url('/logo-completo.svg')" }} role="img" aria-label="Hospital Daniel Bracamonte" />
            </div>
            <p className="mt-7 text-center text-sm font-semibold uppercase tracking-[0.24em] text-white/75">Comunicación hospitalaria</p>
          </div>
        </div>

        <div className="flex items-center justify-center p-3 sm:p-8 lg:p-12">
          <div className="w-full max-w-xl rounded-[28px] bg-white/96 p-4 shadow-[0_24px_70px_rgba(0,0,0,.24)] backdrop-blur-sm sm:p-8 lg:p-10">
            <div className="mx-auto mb-6 grid size-28 place-items-center rounded-full border-6 border-white bg-white shadow-lg lg:hidden">
              <div className="size-22 bg-contain bg-center bg-no-repeat" style={{ backgroundImage: "url('/logo-completo.svg')" }} role="img" aria-label="Hospital Daniel Bracamonte" />
            </div>

            <div className="rounded-[26px] bg-white px-4 py-7 shadow-[0_20px_48px_rgba(17,57,42,.14)] sm:px-8 sm:py-9">
              <header className="text-center">
                <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-[#ca9220]">TV Master</p>
                <h1 className="mt-2 text-3xl font-extrabold tracking-[-.8px] text-[#00452f]">Entre a su cuenta</h1>
                <p className="mt-2 text-sm text-[#73827c]">Ingrese sus credenciales para administrar las pantallas.</p>
              </header>

              <form onSubmit={submit} className="mt-8 space-y-5">
                <label className="block">
                  <b className="mb-2 block text-sm text-[#203a31]">Usuario <i className="not-italic text-[#c74444]">*</i></b>
                  <span className="flex h-14 items-center gap-3 rounded-full border-4 border-[#dcebe4] bg-white px-4 transition focus-within:border-[#8fcab0] focus-within:ring-3 focus-within:ring-[#08783f]/10">
                    <User size={19} className="shrink-0 text-[#658178]" />
                    <input required type="text" value={username} onChange={(event) => setUsername(event.target.value)} className="min-w-0 flex-1 bg-transparent outline-none" autoComplete="username" placeholder="Usuario"  />
                  </span>
                </label>

                <label className="block">
                  <b className="mb-2 block text-sm text-[#203a31]">Contraseña <i className="not-italic text-[#c74444]">*</i></b>
                  <span className="flex h-14 items-center gap-3 rounded-full border border-[#e5ebe8] bg-white px-4 shadow-[0_4px_14px_rgba(24,71,53,.04)] transition focus-within:border-[#8fcab0] focus-within:ring-3 focus-within:ring-[#08783f]/10">
                    <LockKeyhole size={19} className="shrink-0 text-[#658178]" />
                    <input required type={showPassword ? "text" : "password"} value={password} onChange={(event) => setPassword(event.target.value)} className="min-w-0 flex-1 bg-transparent outline-none" autoComplete="current-password" />
                    <button type="button" onClick={() => setShowPassword((current) => !current)} className="grid size-9 place-items-center rounded-full text-[#61736c] transition hover:bg-[#edf5f1]" aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}>{showPassword ? <EyeOff size={20} /> : <Eye size={20} />}</button>
                  </span>
                </label>

                <label className="flex cursor-pointer items-center gap-3 text-sm font-medium text-[#435a51]"><input type="checkbox" checked={remember} onChange={(event) => setRemember(event.target.checked)} className="size-5 rounded accent-[#08783f]" />Recordarme</label>
                {error && <p role="alert" className="rounded-xl border border-[#f2c7ca] bg-[#fff2f3] px-4 py-3 text-sm text-[#ae3039]">{error}</p>}
                <button disabled={loading} className="flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-[#08783f] font-bold text-white shadow-[0_12px_24px_rgba(8,120,63,.2)] transition hover:bg-[#056335] disabled:cursor-wait disabled:opacity-70"><LogIn size={19} />{loading ? "Verificando…" : "Entrar"}</button>
              </form>

            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
