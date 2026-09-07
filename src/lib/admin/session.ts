import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";

const ADMIN_COOKIE = "resin_admin_session";

/**
 * Admin sessions are much shorter than the 30-day store session. An admin
 * cookie can suspend accounts and read every store's details, so leaving one
 * valid for a month on a laptop is a worse trade than signing in again.
 */
const MAX_AGE_SECONDS = 60 * 60 * 12; // 12 hours

/**
 * Both cookies are signed with `SESSION_SECRET`, so the token has to say what
 * it is for. Without this claim a store's own session JWT would verify here,
 * and any store owner could mint themselves an admin session.
 */
const TOKEN_TYPE = "admin";

function getSecretKey() {
  const secret = process.env.SESSION_SECRET;
  if (!secret) {
    throw new Error("SESSION_SECRET environment variable is not set");
  }
  return new TextEncoder().encode(secret);
}

export async function setAdminSessionCookie(adminUserId: string): Promise<void> {
  const token = await new SignJWT({ adminUserId, typ: TOKEN_TYPE })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE_SECONDS}s`)
    .sign(getSecretKey());

  const cookieStore = await cookies();
  cookieStore.set(ADMIN_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    // The admin backend is only ever reached by typing the URL or following an
    // internal link, so it has no reason to accept cross-site navigations.
    sameSite: "strict",
    path: "/",
    maxAge: MAX_AGE_SECONDS,
  });
}

export async function clearAdminSessionCookie(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(ADMIN_COOKIE);
}

export async function getSessionAdminId(): Promise<string | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(ADMIN_COOKIE)?.value;
  if (!token) return null;

  try {
    const { payload } = await jwtVerify(token, getSecretKey());
    if (payload.typ !== TOKEN_TYPE) return null;
    return typeof payload.adminUserId === "string" ? payload.adminUserId : null;
  } catch {
    return null;
  }
}
