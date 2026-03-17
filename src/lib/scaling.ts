import type { Ingredient } from "@/lib/types";

function roundDecimal(value: number, precision = 1): number {
  const factor = 10 ** precision;
  return Math.round(value * factor) / factor;
}

export function scaleValue(
  original: number,
  baseServings: number,
  targetServings: number,
  wholeItem: boolean
): number {
  const raw = (original / baseServings) * targetServings;
  return wholeItem ? Math.max(1, Math.round(raw)) : roundDecimal(raw, 1);
}

export function scaledIngredientDisplay(
  ingredient: Ingredient,
  baseServings: number | null,
  targetServings: number
): string {
  if (!ingredient.quantityValue || !baseServings || baseServings <= 0) {
    return ingredient.quantityText ? `${ingredient.quantityText} ${ingredient.name}` : ingredient.name;
  }

  const scaled = scaleValue(
    ingredient.quantityValue,
    baseServings,
    targetServings,
    ingredient.isWholeItem
  );

  const unit = ingredient.unit ? ingredient.unit.toLowerCase() : "";
  const prefix = unit ? `${scaled} ${unit}` : `${scaled}`;

  return `${prefix} ${ingredient.name}`.trim();
}
