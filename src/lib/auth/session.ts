import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export const SESSION_COOKIE_NAME = "saveur_session";
const SESSION_LIFETIME_SECONDS = 60 * 60 * 24 * 30;
const DEV_DEFAULT_SECRET = "dev-only-saveur-session-secret-change-me";

interface SessionPayload {
  userId: string;
  issuedAt: number;
  expiresAt: number;
}

export interface AuthSession {
  userId: string;
  issuedAt: number;
  expiresAt: number;
}

function encodeBase64Url(value: string): string {
  return Buffer.from(value, "utf8").toString("base64url");
}

function decodeBase64Url(value: string): string | null {
  try {
    return Buffer.from(value, "base64url").toString("utf8");
  } catch {
    return null;
  }
}

function authSecret(): string {
  const configured = process.env.AUTH_SESSION_SECRET?.trim();
  if (configured) {
    return configured;
  }

  if (process.env.NODE_ENV === "production") {
    throw new Error("AUTH_SESSION_SECRET is required in production");
  }

  return DEV_DEFAULT_SECRET;
}

function sign(input: string): string {
  return createHmac("sha256", authSecret()).update(input).digest("base64url");
}

function parseToken(token: string): AuthSession | null {
  const [encodedPayload, signature] = token.split(".");
  if (!encodedPayload || !signature) {
    return null;
  }

  const expected = sign(encodedPayload);
  const providedBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);
  if (providedBuffer.length !== expectedBuffer.length) {
    return null;
  }

  if (!timingSafeEqual(providedBuffer, expectedBuffer)) {
    return null;
  }

  const payloadJson = decodeBase64Url(encodedPayload);
  if (!payloadJson) {
    return null;
  }

  let payload: SessionPayload;
  try {
    payload = JSON.parse(payloadJson) as SessionPayload;
  } catch {
    return null;
  }

  if (
    typeof payload.userId !== "string" ||
    typeof payload.issuedAt !== "number" ||
    typeof payload.expiresAt !== "number"
  ) {
    return null;
  }

  if (Date.now() >= payload.expiresAt * 1000) {
    return null;
  }

  return {
    userId: payload.userId,
    issuedAt: payload.issuedAt,
    expiresAt: payload.expiresAt
  };
}

function createToken(userId: string): { token: string; expiresAt: number; issuedAt: number } {
  const issuedAt = Math.floor(Date.now() / 1000);
  const expiresAt = issuedAt + SESSION_LIFETIME_SECONDS;
  const payload: SessionPayload = { userId, issuedAt, expiresAt };
  const encodedPayload = encodeBase64Url(JSON.stringify(payload));
  const signature = sign(encodedPayload);

  return {
    token: `${encodedPayload}.${signature}`,
    expiresAt,
    issuedAt
  };
}

export function writeSessionCookie(response: NextResponse, userId: string): NextResponse {
  const { token, expiresAt } = createToken(userId);
  response.cookies.set({
    name: SESSION_COOKIE_NAME,
    value: token,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: new Date(expiresAt * 1000)
  });

  return response;
}

export function clearSessionCookie(response: NextResponse): NextResponse {
  response.cookies.set({
    name: SESSION_COOKIE_NAME,
    value: "",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: new Date(0)
  });
  return response;
}

export async function getSession(): Promise<AuthSession | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (!token) {
    return null;
  }

  return parseToken(token);
}
