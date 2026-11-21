import { NextResponse, type NextRequest } from "next/server";

// Friendly navigation for missing Access sessions. Server code verifies the JWT.
export function proxy(request: NextRequest) {
  const path = request.nextUrl.pathname;
  if (path !== "/access-denied" && !path.startsWith("/api/") && !request.headers.get("cf-access-jwt-assertion")) {
    return NextResponse.redirect(new URL("/access-denied", request.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.svg|manifest.webmanifest|sw.js|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
