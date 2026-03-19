import { NextResponse } from "next/server";
import { captureImportFeedback, deleteRecipe, getRecipeById, updateRecipe } from "@/lib/store";
import { normalizeRecipeUpdateInput } from "@/lib/recipe-domain";
import { parseRecipeUpdateInput } from "@/lib/validation";
import { routeErrorResponse } from "@/lib/api/route-helpers";

export async function GET(_: Request, context: { params: Promise<{ id: string }> }) {
  const params = await context.params;
  const recipe = await getRecipeById(params.id);

  if (!recipe) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ recipe });
}

export async function PUT(request: Request, context: { params: Promise<{ id: string }> }) {
  const params = await context.params;
  const recipeBefore = await getRecipeById(params.id);
  if (!recipeBefore) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  try {
    const payload = parseRecipeUpdateInput(await request.json());
    const recipeAfter = await updateRecipe(params.id, normalizeRecipeUpdateInput(payload));

    if (!recipeAfter) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const feedback = await captureImportFeedback(recipeBefore, recipeAfter);

    return NextResponse.json({ recipe: recipeAfter, feedbackCount: feedback.length });
  } catch (error) {
    return routeErrorResponse(error, "Unable to update recipe");
  }
}

export async function DELETE(_: Request, context: { params: Promise<{ id: string }> }) {
  const params = await context.params;
  const deleted = await deleteRecipe(params.id);

  if (!deleted) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ deleted: true });
}
