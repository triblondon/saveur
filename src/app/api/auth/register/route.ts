import { NextResponse } from "next/server";
import { hashPassword, MIN_PASSWORD_LENGTH } from "@/lib/auth/password";
import { writeSessionCookie } from "@/lib/auth/session";
import { createUser } from "@/lib/store";
import { badRequestResponse } from "@/lib/api/route-helpers";

interface RegisterPayload {
  name?: unknown;
  email?: unknown;
  password?: unknown;
}

function parsePayload(value: unknown): { name: string; email: string; password: string } | null {
  const payload = value as RegisterPayload;
  if (!payload || typeof payload !== "object") {
    return null;
  }

  const name = typeof payload.name === "string" ? payload.name.trim() : "";
  const email = typeof payload.email === "string" ? payload.email.trim() : "";
  const password = typeof payload.password === "string" ? payload.password : "";
  if (!name || !email || !password) {
    return null;
  }

  return { name, email, password };
}

export async function POST(request: Request) {
  const parsed = parsePayload(await request.json());
  if (!parsed) {
    return badRequestResponse("name, email, and password are required");
  }
  if (parsed.password.length < MIN_PASSWORD_LENGTH) {
    return badRequestResponse(`password must be at least ${MIN_PASSWORD_LENGTH} characters`);
  }

  try {
    const passwordHash = await hashPassword(parsed.password);
    const user = await createUser({
      name: parsed.name,
      email: parsed.email,
      passwordHash
    });
    return writeSessionCookie(NextResponse.json({ user }, { status: 201 }), user.id);
  } catch (error) {
    if (error instanceof Error && error.message === "EMAIL_EXISTS") {
      return NextResponse.json({ error: "Email is already registered" }, { status: 409 });
    }
    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json({ error: "Unable to create account" }, { status: 500 });
  }
}
