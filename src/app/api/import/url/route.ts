import { NextResponse } from "next/server";
import { importRecipeFromUrl } from "@/lib/import";
import { formatValidationIssues, isValidationError, parseImportUrlRequest } from "@/lib/validation";

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
        error: error instanceof Error ? error.message : "Import failed"
      },
      { status: 500 }
    );
  }
}
