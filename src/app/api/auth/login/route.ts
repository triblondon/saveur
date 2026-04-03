import { NextResponse } from "next/server";
import { verifyPassword } from "@/lib/auth/password";
import { writeSessionCookie } from "@/lib/auth/session";
import { getUserAuthByEmail } from "@/lib/store";
import { badRequestResponse } from "@/lib/api/route-helpers";

interface LoginPayload {
  email?: unknown;
  password?: unknown;
}

export async function POST(request: Request) {
  const payload = (await request.json()) as LoginPayload;
  const email = typeof payload.email === "string" ? payload.email.trim() : "";
  const password = typeof payload.password === "string" ? payload.password : "";
  if (!email || !password) {
    return badRequestResponse("email and password are required");
  }

  const user = await getUserAuthByEmail(email);
  if (!user) {
    return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
  }

  const valid = await verifyPassword(password, user.passwordHash);
  if (!valid) {
    return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
  }

  return writeSessionCookie(
    NextResponse.json({
      user: {
        id: user.id,
        name: user.name,
        email: user.email
      }
    }),
    user.id
  );
}
