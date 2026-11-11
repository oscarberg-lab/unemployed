import { NextResponse, type NextRequest } from "next/server";

/**
 * Single-user protection: when APP_PASSWORD is set (do this for any public deployment),
 * every page asks for it via HTTP Basic auth. The cron endpoint has its own secret.
 */
export function proxy(request: NextRequest) {
  const password = process.env.APP_PASSWORD;
  if (!password) return NextResponse.next();
  const header = request.headers.get("authorization") ?? "";
  if (header.startsWith("Basic ")) {
    const given = atob(header.slice(6)).split(":").slice(1).join(":");
    if (given === password) return NextResponse.next();
  }
  return new NextResponse("Authentication required", {
    status: 401,
    headers: { "WWW-Authenticate": 'Basic realm="Job tool"' },
  });
}

export const config = { matcher: ["/((?!api/cron|_next/static|_next/image|favicon.ico).*)"] };
