import { NextResponse } from "next/server";
import { formatValidationIssues, isValidationError } from "@/lib/validation";

export function validationErrorResponse(error: unknown): NextResponse | null {
  if (!isValidationError(error)) {
    return null;
  }

  return NextResponse.json(
    {
      error: "Validation failed",
      issues: error.issues,
      detail: formatValidationIssues(error.issues)
    },
    { status: 400 }
  );
}

export function internalErrorResponse(error: unknown, fallbackMessage: string): NextResponse {
  return NextResponse.json(
    {
      error: error instanceof Error ? error.message : fallbackMessage
    },
    { status: 500 }
  );
}

export function routeErrorResponse(error: unknown, fallbackMessage: string): NextResponse {
  return validationErrorResponse(error) ?? internalErrorResponse(error, fallbackMessage);
}

export function unauthorizedResponse(message = "Authentication required"): NextResponse {
  return NextResponse.json({ error: message }, { status: 401 });
}

export function forbiddenResponse(message = "Forbidden"): NextResponse {
  return NextResponse.json({ error: message }, { status: 403 });
}

export function badRequestResponse(message: string): NextResponse {
  return NextResponse.json({ error: message }, { status: 400 });
}
