import { NextResponse, type NextRequest } from "next/server";
import { ACCESS_TOKEN_COOKIE, canAccessPath, decodeSessionUser, REFRESH_TOKEN_COOKIE, SESSION_COOKIE } from "@/features/auth/auth-config";

export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const accessToken = request.cookies.get(ACCESS_TOKEN_COOKIE)?.value;
  const refreshToken = request.cookies.get(REFRESH_TOKEN_COOKIE)?.value;
  const user = (accessToken || refreshToken) ? decodeSessionUser(request.cookies.get(SESSION_COOKIE)?.value) : null;

  if (pathname === "/login") {
    return user ? NextResponse.redirect(new URL("/", request.url)) : NextResponse.next();
  }
  if (!user) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", `${pathname}${search}`);
    return NextResponse.redirect(loginUrl);
  }
  if (pathname === "/sin-permiso") return NextResponse.next();
  if (!canAccessPath(user, pathname)) return NextResponse.redirect(new URL("/sin-permiso", request.url));
  return NextResponse.next();
}

export const config = {
  matcher: ["/", "/login", "/sin-permiso", "/usuarios/:path*", "/roles/:path*", "/televisores/:path*", "/contenido/:path*", "/listas/:path*"],
};
