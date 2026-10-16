import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, verifyToken } from "@/lib/auth/token";

const PUBLIC_PATHS = ["/login", "/signup"];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  // Signature check only; membership is re-validated against the database on every request.
  const authenticated = Boolean(await verifyToken(request.cookies.get(SESSION_COOKIE)?.value));
  const isPublic = PUBLIC_PATHS.includes(pathname);

  if (!authenticated && !isPublic) {
    const login = request.nextUrl.clone();
    login.pathname = "/login";
    login.search = pathname !== "/" ? `?next=${encodeURIComponent(pathname + request.nextUrl.search)}` : "";
    return NextResponse.redirect(login);
  }
  if (authenticated && isPublic) {
    const home = request.nextUrl.clone();
    home.pathname = "/";
    home.search = "";
    return NextResponse.redirect(home);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
