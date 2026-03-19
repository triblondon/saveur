import { NextResponse } from "next/server";
import { importRecipeFromUrl } from "@/lib/import";
import { parseImportUrlRequest } from "@/lib/validation";
import { routeErrorResponse } from "@/lib/api/route-helpers";

export async function POST(request: Request) {
  try {
    const payload = parseImportUrlRequest(await request.json());
    const result = await importRecipeFromUrl(payload.url, {
      prompt: payload.prompt ?? null
    });

    return NextResponse.json(result, {
      status: result.status === "FAILED" ? 422 : 200
    });
  } catch (error) {
    return routeErrorResponse(error, "Import failed");
  }
}
