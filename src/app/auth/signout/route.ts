import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE } from "@/lib/auth/token";

/**
 * Clears a session cookie that is validly signed but no longer maps to a membership (member removed,
 * workspace deleted). Server components can't modify cookies, so requireSession redirects here;
 * without this the middleware would bounce the user between /login and the app forever.
 */
export function GET(request: NextRequest) {
  const url = request.nextUrl.clone();
  url.pathname = "/login";
  url.search = "?ended=1";
  const res = NextResponse.redirect(url);
  res.cookies.delete(SESSION_COOKIE);
  return res;
}
