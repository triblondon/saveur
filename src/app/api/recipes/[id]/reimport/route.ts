import { NextResponse } from "next/server";
import { reimportRecipeFromUrl } from "@/lib/import";
import { getRecipeById } from "@/lib/store";
import {
  formatValidationIssues,
  isValidationError,
  parseReimportRecipeRequest
} from "@/lib/validation";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const params = await context.params;
  const recipe = await getRecipeById(params.id);
  if (!recipe) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (recipe.sourceType !== "URL" || !recipe.sourceRef.trim()) {
    return NextResponse.json({ error: "Only URL recipes can be reimported" }, { status: 422 });
  }

  try {
    const rawPayload = (await request.json()) as unknown;
    const payload = parseReimportRecipeRequest(rawPayload);
    const hasPromptField =
      typeof rawPayload === "object" &&
      rawPayload !== null &&
      Object.prototype.hasOwnProperty.call(rawPayload, "prompt");

    const result = await reimportRecipeFromUrl({
      recipeId: recipe.id,
      url: recipe.sourceRef,
      prompt: hasPromptField ? payload.prompt ?? null : recipe.importPrompt ?? null
    });

    return NextResponse.json(result, {
      status: result.status === "FAILED" ? 422 : 200
    });
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
        error: error instanceof Error ? error.message : "Reimport failed"
      },
      { status: 500 }
    );
  }
}
