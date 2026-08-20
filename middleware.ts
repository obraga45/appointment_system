import { NextResponse, type NextRequest } from "next/server";
import { isSupabaseConfigured } from "@/lib/config";
import { updateSession } from "@/lib/supabase/middleware";

const SESSION_COOKIE = "marcaja_session";
const PROTECTED_PREFIXES = ["/dashboard", "/appointments", "/services", "/settings"];

export async function middleware(request: NextRequest) {
  if (isSupabaseConfigured()) {
    return updateSession(request);
  }

  const token = request.cookies.get(SESSION_COOKIE)?.value;
  const userId = token?.split(".")[0];
  const pathname = request.nextUrl.pathname;
  const isProtected = PROTECTED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );

  if (isProtected && !userId) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/login";
    redirectUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(redirectUrl);
  }

  if (userId && (pathname === "/login" || pathname === "/register")) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/dashboard";
    return NextResponse.redirect(redirectUrl);
  }

  return NextResponse.next({ request });
}

export const config = {
  matcher: ["/dashboard/:path*", "/appointments/:path*", "/services/:path*", "/settings/:path*", "/login", "/register"],
};
