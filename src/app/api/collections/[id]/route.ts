import { NextResponse } from "next/server";
import { getCurrentUser, touchSession } from "@/lib/auth/current-user";
import {
  deleteCollectionForOwner,
  getCollectionDetailForUser,
  updateCollectionForUser
} from "@/lib/store";
import {
  forbiddenResponse,
  routeErrorResponse,
  unauthorizedResponse
} from "@/lib/api/route-helpers";

interface UpdateCollectionPayload {
  name?: unknown;
  description?: unknown;
  visibility?: unknown;
}

interface DeletePayload {
  mode?: unknown;
  targetCollectionId?: unknown;
}

function parseUpdatePayload(value: unknown): {
  name: string;
  description: string | null;
  visibility: "public" | "private";
} {
  const payload = value as UpdateCollectionPayload;
  const name = typeof payload?.name === "string" ? payload.name.trim() : "";
  if (!name) {
    throw new Error("Collection name is required");
  }
  return {
    name,
    description:
      typeof payload?.description === "string" && payload.description.trim() ? payload.description.trim() : null,
    visibility: payload?.visibility === "public" ? "public" : "private"
  };
}

function parseDeletePayload(value: unknown): { mode: "DELETE_RECIPES" | "REASSIGN"; targetCollectionId?: string } {
  const payload = value as DeletePayload;
  if (payload?.mode === "REASSIGN") {
    const targetCollectionId =
      typeof payload.targetCollectionId === "string" ? payload.targetCollectionId.trim() : "";
    if (!targetCollectionId) {
      throw new Error("targetCollectionId is required when mode is REASSIGN");
    }
    return { mode: "REASSIGN", targetCollectionId };
  }
  return { mode: "DELETE_RECIPES" };
}

export async function GET(_: Request, context: { params: Promise<{ id: string }> }) {
  const params = await context.params;
  const user = await getCurrentUser();
  const detail = await getCollectionDetailForUser(params.id, user?.id ?? null);
  if (!detail) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (!user) {
    return NextResponse.json({ collection: detail });
  }
  return touchSession(NextResponse.json({ collection: detail }), user);
}

export async function PUT(request: Request, context: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) {
    return unauthorizedResponse();
  }

  const params = await context.params;
  try {
    const payload = parseUpdatePayload(await request.json());
    const updated = await updateCollectionForUser(user.id, params.id, payload);
    if (!updated) {
      return forbiddenResponse();
    }
    return touchSession(NextResponse.json({ collection: updated }), user);
  } catch (error) {
    return routeErrorResponse(error, "Unable to update collection");
  }
}

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) {
    return unauthorizedResponse();
  }
  const params = await context.params;

  try {
    const payload = parseDeletePayload(await request.json().catch(() => ({ mode: "DELETE_RECIPES" })));
    const deleted = await deleteCollectionForOwner(user.id, params.id, payload);
    if (!deleted) {
      return forbiddenResponse();
    }
    return touchSession(NextResponse.json({ deleted: true }), user);
  } catch (error) {
    return routeErrorResponse(error, "Unable to delete collection");
  }
}
