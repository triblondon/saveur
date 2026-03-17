import { NextResponse } from "next/server";
import { createManualRecipe, listRecipes } from "@/lib/store";
import { formatValidationIssues, isValidationError, parseRecipeCreateInput } from "@/lib/validation";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const query = url.searchParams.get("q") ?? undefined;

  const recipes = await listRecipes(query);
  return NextResponse.json({ recipes });
}

export async function POST(request: Request) {
  try {
    const payload = parseRecipeCreateInput(await request.json());
    const recipe = await createManualRecipe(payload);

    return NextResponse.json({ recipe }, { status: 201 });
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
        error: error instanceof Error ? error.message : "Unable to create recipe"
      },
      { status: 500 }
    );
  }
}
