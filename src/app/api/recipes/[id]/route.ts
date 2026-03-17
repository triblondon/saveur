import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { captureImportFeedback, deleteRecipe, getRecipeById, updateRecipe } from "@/lib/store";
import type { CookStep, Ingredient, PrepTask, Recipe } from "@/lib/types";
import { formatValidationIssues, isValidationError, parseRecipeUpdateInput } from "@/lib/validation";

function toIngredientUpdates(items: Ingredient[]): Ingredient[] {
  return items.map((item, index) => ({
    id: item.id || randomUUID(),
    position: index,
    name: item.name,
    quantityText: item.quantityText,
    quantityValue: item.quantityValue,
    quantityMin: item.quantityMin,
    quantityMax: item.quantityMax,
    unit: item.unit,
    isWholeItem: item.isWholeItem,
    optional: item.optional,
    isPantryItem: item.isPantryItem
  }));
}

function toPrepTaskUpdates(items: PrepTask[]): PrepTask[] {
  return items.map((item, index) => ({
    id: item.id || randomUUID(),
    position: index,
    title: item.title,
    detail: item.detail
  }));
}

function toCookStepUpdates(items: CookStep[]): CookStep[] {
  return items.map((item, index) => ({
    id: item.id || randomUUID(),
    position: index,
    instruction: item.instruction,
    detail: item.detail,
    timerSeconds: item.timerSeconds,
    prepTaskRefs: item.prepTaskRefs
  }));
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

    const updatePayload: Partial<Omit<Recipe, "id" | "createdAt">> = {};

    if (payload.title !== undefined) {
      updatePayload.title = payload.title;
    }
    if (payload.sourceRef !== undefined) {
      updatePayload.sourceRef = payload.sourceRef;
    }
    if (payload.sourceType !== undefined) {
      updatePayload.sourceType = payload.sourceType;
    }
    if (payload.description !== undefined) {
      updatePayload.description = payload.description;
    }
    if (payload.servingCount !== undefined) {
      updatePayload.servingCount = payload.servingCount;
    }
    if (payload.timeRequiredMinutes !== undefined) {
      updatePayload.timeRequiredMinutes = payload.timeRequiredMinutes;
    }
    if (payload.heroPhotoUrl !== undefined) {
      updatePayload.heroPhotoUrl = payload.heroPhotoUrl;
    }

    if (payload.tags) {
      updatePayload.tags = payload.tags;
    }

    if (payload.ingredients) {
      updatePayload.ingredients = toIngredientUpdates(
        payload.ingredients.map((item, index): Ingredient => ({
          id: recipeBefore.ingredients[index]?.id ?? randomUUID(),
          position: index,
          name: item.name,
          quantityText: item.quantityText ?? null,
          quantityValue: item.quantityValue ?? null,
          quantityMin: item.quantityMin ?? null,
          quantityMax: item.quantityMax ?? null,
          unit: item.unit ?? null,
          isWholeItem: item.isWholeItem ?? false,
          optional: item.optional ?? false,
          isPantryItem: item.isPantryItem ?? false
        }))
      );
    }

    if (payload.prepTasks) {
      updatePayload.prepTasks = toPrepTaskUpdates(
        payload.prepTasks.map((item, index): PrepTask => ({
          id: recipeBefore.prepTasks[index]?.id ?? randomUUID(),
          position: index,
          title: item.title,
          detail: item.detail ?? null
        }))
      );
    }

    if (payload.cookSteps) {
      updatePayload.cookSteps = toCookStepUpdates(
        payload.cookSteps.map((item, index): CookStep => ({
          id: recipeBefore.cookSteps[index]?.id ?? randomUUID(),
          position: index,
          instruction: item.instruction,
          detail: item.detail ?? null,
          timerSeconds: item.timerSeconds ?? null,
          prepTaskRefs: item.prepTaskRefs ?? []
        }))
      );
    }

    const recipeAfter = await updateRecipe(params.id, updatePayload);

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
