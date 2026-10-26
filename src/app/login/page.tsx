import { Suspense } from "react";
import { LoginForm } from "@/features/auth/login-form";

export default function LoginPage() {
  return <Suspense fallback={<div className="grid min-h-screen place-items-center bg-[#f3f7f5] text-[#52645c]">Preparando acceso…</div>}><LoginForm /></Suspense>;
}
