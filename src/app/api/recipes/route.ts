import { NextResponse } from "next/server";
import { createManualRecipe, listRecipes } from "@/lib/store";
import { parseRecipeCreateInput } from "@/lib/validation";
import { routeErrorResponse } from "@/lib/api/route-helpers";

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
    return routeErrorResponse(error, "Unable to create recipe");
  }
}
