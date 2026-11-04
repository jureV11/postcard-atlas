import { NextResponse } from "next/server";

/**
 * Send the browser to a path on this site. The Location is relative, so the
 * browser stays on the address it came in on: behind the live server's proxy,
 * `request.url` is the app's own https://0.0.0.0:3000, which no phone can open.
 * Anything but a plain path here (like "//other.site" or "/\other.site", which
 * browsers read as another website) goes home instead.
 */
export function redirectTo(path: string, status: 303 | 307 = 307): NextResponse {
  const safe = /^\/(?![/\\])/.test(path) ? path : "/";
  return new NextResponse(null, { status, headers: { Location: safe } });
}
