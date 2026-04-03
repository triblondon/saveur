import type { NextResponse } from "next/server";
import { getSession, writeSessionCookie } from "@/lib/auth/session";
import { getUserById } from "@/lib/store";
import type { UserSummary } from "@/lib/types";

export interface AuthenticatedUser {
  id: string;
  name: string;
  email: string;
}

export async function getCurrentUser(): Promise<AuthenticatedUser | null> {
  const session = await getSession();
  if (!session) {
    return null;
  }

  const user = await getUserById(session.userId);
  if (!user) {
    return null;
  }

  return user;
}

export function touchSession(response: NextResponse, user: Pick<UserSummary, "id">): NextResponse {
  return writeSessionCookie(response, user.id);
}
