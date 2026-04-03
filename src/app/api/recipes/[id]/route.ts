import { NextResponse } from "next/server";
import { getCurrentUser, touchSession } from "@/lib/auth/current-user";
import { deleteRecipeForUser, getRecipeByIdForUser, updateRecipeForUser } from "@/lib/store";
import { normalizeRecipeUpdateInput } from "@/lib/recipe-domain";
import { parseRecipeMutationRequest } from "@/lib/validation";
import {
  forbiddenResponse,
  routeErrorResponse,
  unauthorizedResponse
} from "@/lib/api/route-helpers";

export async function GET(_: Request, context: { params: Promise<{ id: string }> }) {
  const params = await context.params;
  const user = await getCurrentUser();
  const recipe = await getRecipeByIdForUser(params.id, user?.id ?? null);

  if (!recipe) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (!user) {
    return NextResponse.json({ recipe });
  }
  return touchSession(NextResponse.json({ recipe }), user);
}

export async function PUT(request: Request, context: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) {
    return unauthorizedResponse();
  }

  const params = await context.params;
  const existingRecipe = await getRecipeByIdForUser(params.id, user.id);
  if (!existingRecipe) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  try {
    const payload = parseRecipeMutationRequest(await request.json());
    const recipeAfter = await updateRecipeForUser(user.id, params.id, {
      ...normalizeRecipeUpdateInput(payload.recipe),
      collectionId: payload.collectionId
    });

    if (!recipeAfter) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    return touchSession(NextResponse.json({ recipe: recipeAfter }), user);
  } catch (error) {
    if (error instanceof Error && error.message.includes("No write access")) {
      return forbiddenResponse();
    }
    return routeErrorResponse(error, "Unable to update recipe");
  }
}

export async function DELETE(_: Request, context: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) {
    return unauthorizedResponse();
  }

  const params = await context.params;
  try {
    const deleted = await deleteRecipeForUser(user.id, params.id);

    if (!deleted) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    return touchSession(NextResponse.json({ deleted: true }), user);
  } catch (error) {
    if (error instanceof Error && error.message.includes("No write access")) {
      return forbiddenResponse();
    }
    return routeErrorResponse(error, "Unable to delete recipe");
  }
}
