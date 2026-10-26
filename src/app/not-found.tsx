import Link from "next/link";
import { ArrowLeft, Home, MapPinOff } from "lucide-react";

export default function NotFound() {
  return (
    <main className="relative grid min-h-screen place-items-center overflow-hidden bg-[#f3f7f5] px-5 py-12 text-[#17231e]">
      <div className="absolute inset-x-0 top-0 h-2 bg-[#08783f]" />
      <div className="absolute -left-32 -top-32 size-96 rounded-full bg-[#dff1e8] blur-3xl" />
      <div className="absolute -bottom-40 -right-32 size-96 rounded-full bg-[#f8e8bd] opacity-70 blur-3xl" />

      <section className="relative w-full max-w-2xl rounded-[30px] border border-[#dbe5e0] bg-white p-8 text-center shadow-[0_24px_70px_rgba(20,62,46,.12)] sm:p-12">
        <div className="mx-auto grid size-20 place-items-center rounded-3xl bg-[#e5f4ec] text-[#08783f]">
          <MapPinOff size={38} strokeWidth={1.8} />
        </div>
        <p className="mt-7 text-sm font-extrabold uppercase tracking-[0.24em] text-[#c58a17]">Error 404</p>
        <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-[#064c36] sm:text-4xl">Página no encontrada</h1>
        <p className="mx-auto mt-4 max-w-lg leading-7 text-[#65766f]">La dirección que intentas abrir no existe o fue movida. Puedes volver al panel principal para continuar administrando TV Master.</p>
        <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
          <Link href="/" className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-[#08783f] px-6 font-semibold text-white transition hover:bg-[#066734]"><Home size={18} />Ir al inicio</Link>
          <Link href="/usuarios" className="inline-flex h-12 items-center justify-center gap-2 rounded-xl border border-[#cfdcd6] px-6 font-semibold text-[#315447] transition hover:bg-[#f0f7f3]"><ArrowLeft size={18} />Volver a usuarios</Link>
        </div>
      </section>
    </main>
  );
}
