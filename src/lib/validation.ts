import Ajv, { type ErrorObject } from "ajv";
import addFormats from "ajv-formats";
import { getOpenApiDereferencedSchema, getOpenApiRefSchema } from "@/lib/openapi";
import type {
  ImportDraft,
  ImportUrlRequest,
  ReimportRecipeRequest,
  RecipeCreateInput,
  RecipeUpdateInput
} from "@/lib/types";

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
  const validate = ajv.compile(getOpenApiRefSchema(schemaName));

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
