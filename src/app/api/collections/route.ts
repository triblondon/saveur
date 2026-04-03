import { NextResponse } from "next/server";
import { getCurrentUser, touchSession } from "@/lib/auth/current-user";
import {
  createCollectionForUser,
  listCollectionsForUser,
  listWritableCollectionsForUser
} from "@/lib/store";
import { unauthorizedResponse, routeErrorResponse } from "@/lib/api/route-helpers";

interface CreateCollectionPayload {
  name?: unknown;
  description?: unknown;
  visibility?: unknown;
}

function parseCreateCollectionPayload(value: unknown): {
  name: string;
  description: string | null;
  visibility: "public" | "private";
} {
  const payload = value as CreateCollectionPayload;
  const name = typeof payload?.name === "string" ? payload.name.trim() : "";
  const description =
    typeof payload?.description === "string" && payload.description.trim() ? payload.description.trim() : null;
  const visibility = payload?.visibility === "public" ? "public" : "private";
  if (!name) {
    throw new Error("Collection name is required");
  }
  return { name, description, visibility };
}

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return unauthorizedResponse();
  }

  const url = new URL(request.url);
  const writableOnly = url.searchParams.get("writable") === "true";
  const collections = writableOnly
    ? await listWritableCollectionsForUser(user.id)
    : await listCollectionsForUser(user.id);
  return touchSession(NextResponse.json({ collections }), user);
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return unauthorizedResponse();
  }

  try {
    const payload = parseCreateCollectionPayload(await request.json());
    const collection = await createCollectionForUser(user.id, payload);
    return touchSession(NextResponse.json({ collection }, { status: 201 }), user);
  } catch (error) {
    return routeErrorResponse(error, "Unable to create collection");
  }
}
