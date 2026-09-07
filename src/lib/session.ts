import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";

const SESSION_COOKIE = "resin_session";
const MAX_AGE_SECONDS = 60 * 60 * 24 * 30; // 30 days

/**
 * An admin looking at a store's dashboard gets a much shorter session than the
 * owner does. It is a support tool, not a way to stay signed in as someone
 * else, and it should lapse on its own if it is forgotten about.
 */
const IMPERSONATION_MAX_AGE_SECONDS = 60 * 60; // 1 hour

export interface SessionInfo {
  storeId: string;
  /** Set when an admin is viewing this store's dashboard through impersonation. */
  impersonatedByAdminId: string | null;
}

export interface SessionOptions {
  impersonatedByAdminId?: string | null;
}

function getSecretKey() {
  const secret = process.env.SESSION_SECRET;
  if (!secret) {
    throw new Error("SESSION_SECRET environment variable is not set");
  }
  return new TextEncoder().encode(secret);
}

export async function createSessionToken(
  storeId: string,
  options: SessionOptions = {},
): Promise<string> {
  const maxAge = options.impersonatedByAdminId
    ? IMPERSONATION_MAX_AGE_SECONDS
    : MAX_AGE_SECONDS;

  return new SignJWT({
    storeId,
    ...(options.impersonatedByAdminId ? { imp: options.impersonatedByAdminId } : {}),
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${maxAge}s`)
    .sign(getSecretKey());
}

export async function setSessionCookie(
  storeId: string,
  options: SessionOptions = {},
): Promise<void> {
  const token = await createSessionToken(storeId, options);
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: options.impersonatedByAdminId ? IMPERSONATION_MAX_AGE_SECONDS : MAX_AGE_SECONDS,
  });
}

export async function clearSessionCookie(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE);
}

export async function getSession(): Promise<SessionInfo | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, getSecretKey());
    if (typeof payload.storeId !== "string") return null;
    return {
      storeId: payload.storeId,
      impersonatedByAdminId: typeof payload.imp === "string" ? payload.imp : null,
    };
  } catch {
    return null;
  }
}

export async function getSessionStoreId(): Promise<string | null> {
  return (await getSession())?.storeId ?? null;
}
