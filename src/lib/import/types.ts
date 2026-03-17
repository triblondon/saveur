import type { CookStepData, ImportConfidence, IngredientData, PrepTaskData } from "@/lib/types";

export type ParsedIngredientDraft = IngredientData;
export type ParsedPrepTaskDraft = PrepTaskData;
export type ParsedCookStepDraft = CookStepData;
export type ParseConfidence = ImportConfidence;

export interface ParsedRecipeDraft {
  title: string;
  description: string | null;
  heroPhotoUrl: string | null;
  servingCount: number | null;
  timeRequiredMinutes: number | null;
  tags: string[];
  ingredients: ParsedIngredientDraft[];
  prepTasks: ParsedPrepTaskDraft[];
  cookSteps: ParsedCookStepDraft[];
  confidence: ParseConfidence;
  warnings: string[];
}
