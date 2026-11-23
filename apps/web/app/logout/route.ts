import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE } from "@/lib/session";

// A route handler rather than a page, because only handlers and actions can change cookies.
// GET is also used to clear a stale session (e.g. the database was reset).
function logout(request: NextRequest) {
  const response = NextResponse.redirect(new URL("/", request.url), 303);
  response.cookies.delete(SESSION_COOKIE);
  return response;
}

export { logout as GET, logout as POST };
