import { NextResponse } from "next/server";
import { getCurrentUser, touchSession } from "@/lib/auth/current-user";
import {
  addCollectionMemberByEmail,
  removeCollectionMemberForOwner
} from "@/lib/store";
import {
  forbiddenResponse,
  routeErrorResponse,
  unauthorizedResponse
} from "@/lib/api/route-helpers";

interface AddMemberPayload {
  email?: unknown;
  role?: unknown;
}

interface RemoveMemberPayload {
  userId?: unknown;
}

function parseAddPayload(value: unknown): { email: string; role: "COLLABORATOR" | "VIEWER" } {
  const payload = value as AddMemberPayload;
  const email = typeof payload?.email === "string" ? payload.email.trim() : "";
  if (!email) {
    throw new Error("Member email is required");
  }
  return {
    email,
    role: payload?.role === "VIEWER" ? "VIEWER" : "COLLABORATOR"
  };
}

function parseRemovePayload(value: unknown): { userId: string } {
  const payload = value as RemoveMemberPayload;
  const userId = typeof payload?.userId === "string" ? payload.userId.trim() : "";
  if (!userId) {
    throw new Error("userId is required");
  }
  return { userId };
}

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) {
    return unauthorizedResponse();
  }
  const params = await context.params;

  try {
    const payload = parseAddPayload(await request.json());
    const collection = await addCollectionMemberByEmail(user.id, params.id, payload.email, payload.role);
    if (!collection) {
      return forbiddenResponse();
    }
    return touchSession(NextResponse.json({ collection }), user);
  } catch (error) {
    if (error instanceof Error && error.message === "USER_NOT_FOUND") {
      return NextResponse.json({ error: "User not found for that email" }, { status: 404 });
    }
    return routeErrorResponse(error, "Unable to add member");
  }
}

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) {
    return unauthorizedResponse();
  }
  const params = await context.params;

  try {
    const payload = parseRemovePayload(await request.json());
    const collection = await removeCollectionMemberForOwner(user.id, params.id, payload.userId);
    if (!collection) {
      return forbiddenResponse();
    }
    return touchSession(NextResponse.json({ collection }), user);
  } catch (error) {
    return routeErrorResponse(error, "Unable to remove member");
  }
}
