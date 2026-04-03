import { NextResponse } from "next/server";
import { getCurrentUser, touchSession } from "@/lib/auth/current-user";
import { importRecipeFromUrl } from "@/lib/import";
import { parseImportUrlRequest } from "@/lib/validation";
import { badRequestResponse, routeErrorResponse, unauthorizedResponse } from "@/lib/api/route-helpers";

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return unauthorizedResponse();
  }

  try {
    const raw = (await request.json()) as Record<string, unknown>;
    const payload = parseImportUrlRequest({
      url: raw.url,
      prompt: raw.prompt
    });
    const collectionId = typeof raw.collectionId === "string" ? raw.collectionId.trim() : "";
    if (!collectionId) {
      return badRequestResponse("collectionId is required");
    }
    const result = await importRecipeFromUrl(payload.url, {
      prompt: payload.prompt ?? null,
      userId: user.id,
      collectionId
    });

    return touchSession(NextResponse.json(result, {
      status: result.status === "FAILED" ? 422 : 200
    }), user);
  } catch (error) {
    return routeErrorResponse(error, "Import failed");
  }
}
