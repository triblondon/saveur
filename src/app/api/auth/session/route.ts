import { NextResponse } from "next/server";
import { getCurrentUser, touchSession } from "@/lib/auth/current-user";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ user: null });
  }
  return touchSession(NextResponse.json({ user }), user);
}
