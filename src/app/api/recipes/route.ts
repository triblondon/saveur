import { NextResponse } from "next/server";
import { getCurrentUser, touchSession } from "@/lib/auth/current-user";
import { createManualRecipeForUser, listRecipesForUser } from "@/lib/store";
import { parseRecipeMutationRequest } from "@/lib/validation";
import {
  forbiddenResponse,
  routeErrorResponse,
  unauthorizedResponse
} from "@/lib/api/route-helpers";

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return unauthorizedResponse();
  }

  const url = new URL(request.url);
  const query = url.searchParams.get("q") ?? undefined;

  const recipes = await listRecipesForUser(user.id, query);
  return touchSession(NextResponse.json({ recipes }), user);
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return unauthorizedResponse();
  }

  try {
    const payload = parseRecipeMutationRequest(await request.json());
    const recipe = await createManualRecipeForUser({
      userId: user.id,
      collectionId: payload.collectionId,
      recipe: payload.recipe
    });

    return touchSession(NextResponse.json({ recipe }, { status: 201 }), user);
  } catch (error) {
    if (error instanceof Error && error.message.includes("No write access")) {
      return forbiddenResponse();
    }
    return routeErrorResponse(error, "Unable to create recipe");
  }
}
