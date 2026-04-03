import { NextResponse } from "next/server";
import { getCurrentUser, touchSession } from "@/lib/auth/current-user";
import { reimportRecipeFromUrl } from "@/lib/import";
import { getRecipeByIdForUser } from "@/lib/store";
import { parseReimportRecipeRequest } from "@/lib/validation";
import {
  forbiddenResponse,
  routeErrorResponse,
  unauthorizedResponse
} from "@/lib/api/route-helpers";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) {
    return unauthorizedResponse();
  }

  const params = await context.params;
  const recipe = await getRecipeByIdForUser(params.id, user.id);
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
      userId: user.id,
      recipeId: recipe.id,
      url: recipe.sourceRef,
      prompt: hasPromptField ? payload.prompt ?? null : recipe.importPrompt ?? null
    });

    return touchSession(NextResponse.json(result, {
      status: result.status === "FAILED" ? 422 : 200
    }), user);
  } catch (error) {
    if (error instanceof Error && error.message.includes("No write access")) {
      return forbiddenResponse();
    }
    return routeErrorResponse(error, "Reimport failed");
  }
}
