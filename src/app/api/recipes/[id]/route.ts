import { NextResponse } from "next/server";
import { captureImportFeedback, deleteRecipe, getRecipeById, updateRecipe } from "@/lib/store";
import type { Recipe, RecipeUpdateInput } from "@/lib/types";
import { formatValidationIssues, isValidationError, parseRecipeUpdateInput } from "@/lib/validation";

function normalizeFullRecipe(payload: RecipeUpdateInput): Partial<Omit<Recipe, "id" | "createdAt">> {
  return {
    title: payload.title.trim(),
    description: payload.description,
    heroPhotoUrl: payload.heroPhotoUrl,
    servingCount: payload.servingCount,
    timeRequiredMinutes: payload.timeRequiredMinutes,
    tags: payload.tags.map((tag) => tag.trim()).filter(Boolean),
    sourceType: payload.sourceType,
    sourceRef: payload.sourceRef.trim(),
    importPrompt: payload.importPrompt,
    importRunId: payload.importRunId,
    ingredients: payload.ingredients.map((item) => ({
      name: item.name.trim(),
      quantityText: item.quantityText,
      quantityValue: item.quantityValue,
      quantityMin: item.quantityMin,
      quantityMax: item.quantityMax,
      unit: item.unit ?? "UNKNOWN",
      isWholeItem: item.isWholeItem,
      optional: item.optional,
      isPantryItem: item.isPantryItem
    })),
    prepTasks: payload.prepTasks.map((item) => ({
      preparationName: item.preparationName.trim(),
      sourceIngredients: item.sourceIngredients.map((name) => name.trim()).filter(Boolean),
      detail: item.detail
    })),
    cookSteps: payload.cookSteps.map((item) => ({
      instruction: item.instruction.trim(),
      detail: item.detail,
      sourceIngredients: item.sourceIngredients?.map((name) => name.trim()).filter(Boolean),
      timerSeconds: item.timerSeconds
    }))
  };
}

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
    const recipeAfter = await updateRecipe(params.id, normalizeFullRecipe(payload));

    if (!recipeAfter) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const feedback = await captureImportFeedback(recipeBefore, recipeAfter);

    return NextResponse.json({ recipe: recipeAfter, feedbackCount: feedback.length });
  } catch (error) {
    if (isValidationError(error)) {
      return NextResponse.json(
        {
          error: "Validation failed",
          issues: error.issues,
          detail: formatValidationIssues(error.issues)
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Unable to update recipe"
      },
      { status: 500 }
    );
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
