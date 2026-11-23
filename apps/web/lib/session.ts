import { cookies } from "next/headers";

// The cookie holds the user's UUID. The participant code is the only credential, so this
// is no weaker than the login itself. httpOnly keeps it away from page scripts.
export const SESSION_COOKIE = "plp_user";

export const sessionCookieOptions = {
  httpOnly: true,
  sameSite: "lax",
  path: "/",
  // Set COOKIE_SECURE=true once the app is served over HTTPS (the pilot deployment).
  secure: process.env.COOKIE_SECURE === "true",
  maxAge: 60 * 60 * 24 * 30,
} as const;

export async function getUserId(): Promise<string | null> {
  return (await cookies()).get(SESSION_COOKIE)?.value ?? null;
}
