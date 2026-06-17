import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  const url = request.nextUrl.clone();
  const host = request.headers.get("host") || "localhost:3000";

  // Skip static files, Next.js internal routes, and API routes
  if (
    url.pathname.startsWith("/_next") ||
    url.pathname.startsWith("/api") ||
    url.pathname.includes(".")
  ) {
    return NextResponse.next();
  }

  const hostParts = host.split(":");
  const domainOnly = hostParts[0];
  const domainParts = domainOnly.split(".");

  let subdomain = "";
  let isPortal = false;
  let centerSlug = "";

  if (domainParts.includes("portal")) {
    isPortal = true;
    const portalIdx = domainParts.indexOf("portal");
    if (portalIdx > 0) {
      centerSlug = domainParts[portalIdx - 1];
    }
  } else if (domainOnly.includes("localhost") || domainOnly.includes("127.0.0.1")) {
    // Localhost format: [subdomain].localhost:3000
    if (domainParts.length > 1 && domainParts[domainParts.length - 1] === "localhost") {
      subdomain = domainParts[0];
    }
  } else {
    // Production format: [subdomain].platform.domain
    if (domainParts.length >= 3) {
      subdomain = domainParts[0];
    }
  }

  if (isPortal && centerSlug) {
    // Rewrite to center portal page: /center/[centerSlug]/[path]
    if (!url.pathname.startsWith(`/center/${centerSlug}`)) {
      url.pathname = `/center/${centerSlug}${url.pathname}`;
    }
    return NextResponse.rewrite(url);
  }

  if (subdomain && subdomain !== "parikshasetu" && subdomain !== "leakguard") {
    if (subdomain === "admin") {
      // Rewrite to /admin route group
      if (!url.pathname.startsWith("/admin")) {
        url.pathname = `/admin${url.pathname}`;
      }
      return NextResponse.rewrite(url);
    } else {
      // Rewrite to multi-tenant agency route group: /agency/[slug]/[path]
      if (!url.pathname.startsWith(`/agency/${subdomain}`)) {
        url.pathname = `/agency/${subdomain}${url.pathname}`;
      }
      return NextResponse.rewrite(url);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all paths except for:
     * 1. /api routes
     * 2. /_next (Next.js internals)
     * 3. /_static (inside /public)
     * 4. all static files (e.g. favicon.ico, logo.png)
     */
    "/((?!api|_next|_static|_next/image|favicon.ico|.*\\..*).*)",
  ],
};
