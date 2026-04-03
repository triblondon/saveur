import Ajv, { type ErrorObject } from "ajv";
import addFormats from "ajv-formats";
import { getOpenApiDereferencedSchema } from "@/lib/openapi";
import type {
  ImportDraft,
  ImportUrlRequest,
  ReimportRecipeRequest,
  RecipeCreateInput,
  RecipeUpdateInput
} from "@/lib/types";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

class ValidationError extends Error {
  issues: ErrorObject[];

  constructor(message: string, issues: ErrorObject[]) {
    super(message);
    this.name = "ValidationError";
    this.issues = issues;
  }
}

const ajv = new Ajv({
  allErrors: true,
  strict: false
});

addFormats(ajv);

function createParser<T>(schemaName: keyof import("@/generated/openapi").components["schemas"]) {
  const validate = ajv.compile(getOpenApiDereferencedSchema(schemaName));

  return (value: unknown): T => {
    if (validate(value)) {
      return value as T;
    }

    throw new ValidationError(`Validation failed for ${String(schemaName)}`, validate.errors ?? []);
  };
}

function createValidator<T>(schemaName: keyof import("@/generated/openapi").components["schemas"]) {
  const validate = ajv.compile(getOpenApiDereferencedSchema(schemaName));

  return (value: unknown): { valid: true; value: T } | { valid: false; issues: ErrorObject[] } => {
    if (validate(value)) {
      return { valid: true, value: value as T };
    }

    return { valid: false, issues: validate.errors ?? [] };
  };
}

export function formatValidationIssues(issues: ErrorObject[]): string {
  return issues
    .map((issue) => {
      const path = issue.instancePath || "/";
      return `${path} ${issue.message ?? "invalid"}`;
    })
    .join("; ");
}

export function isValidationError(error: unknown): error is ValidationError {
  return error instanceof ValidationError;
}

export const parseImportUrlRequest = createParser<ImportUrlRequest>("ImportUrlRequest");
export const parseReimportRecipeRequest = createParser<ReimportRecipeRequest>("ReimportRecipeRequest");
export const parseRecipeCreateInput = createParser<RecipeCreateInput>("BaseRecipe");
export const parseRecipeUpdateInput = createParser<RecipeUpdateInput>("BaseRecipe");

export const validateImportDraft = createValidator<ImportDraft>("RecipeFromLlmImport");

export function parseRecipeMutationRequest(value: unknown): {
  collectionId: string;
  recipe: RecipeCreateInput;
} {
  const payload = value as Record<string, unknown>;
  const collectionIdRaw = typeof payload?.collectionId === "string" ? payload.collectionId.trim() : "";
  if (!collectionIdRaw || !UUID_PATTERN.test(collectionIdRaw)) {
    throw new ValidationError("Validation failed for collectionId", [
      {
        instancePath: "/collectionId",
        schemaPath: "#/properties/collectionId",
        keyword: "format",
        params: {},
        message: "must be a UUID"
      }
    ]);
  }

  if (!payload || typeof payload !== "object") {
    throw new ValidationError("Validation failed for recipe payload", []);
  }

  const { collectionId: _collectionId, ...rest } = payload;
  const recipe = parseRecipeCreateInput(rest);
  return {
    collectionId: collectionIdRaw,
    recipe
  };
}
