import { NextResponse } from "next/server";
import { reimportRecipeFromUrl } from "@/lib/import";
import { getRecipeById } from "@/lib/store";
import { parseReimportRecipeRequest } from "@/lib/validation";
import { routeErrorResponse } from "@/lib/api/route-helpers";

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
    return routeErrorResponse(error, "Reimport failed");
  }
}
