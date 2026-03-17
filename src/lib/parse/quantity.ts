import type { Unit } from "@/lib/types";

export interface ParsedQuantity {
  name: string;
  quantityText: string | null;
  quantityValue: number | null;
  quantityMin: number | null;
  quantityMax: number | null;
  unit: Unit | null;
  isWholeItem: boolean;
}

const FRACTION_MAP: Record<string, string> = {
  "\u00bc": "1/4",
  "\u00bd": "1/2",
  "\u00be": "3/4",
  "\u2150": "1/7",
  "\u2151": "1/9",
  "\u2152": "1/10",
  "\u2153": "1/3",
  "\u2154": "2/3",
  "\u2155": "1/5",
  "\u2156": "2/5",
  "\u2157": "3/5",
  "\u2158": "4/5",
  "\u2159": "1/6",
  "\u215a": "5/6",
  "\u215b": "1/8",
  "\u215c": "3/8",
  "\u215d": "5/8",
  "\u215e": "7/8"
};

function decodeFractionToken(token: string): number | null {
  const trimmed = token.trim();

  if (/^\d+\s+\d+\/\d+$/.test(trimmed)) {
    const [whole, fraction] = trimmed.split(/\s+/);
    const wholeValue = Number(whole);
    const fractionValue = decodeFractionToken(fraction);
    if (Number.isFinite(wholeValue) && fractionValue !== null) {
      return wholeValue + fractionValue;
    }
  }

  if (/^\d+\/\d+$/.test(trimmed)) {
    const [num, den] = trimmed.split("/").map(Number);
    if (den !== 0 && Number.isFinite(num) && Number.isFinite(den)) {
      return num / den;
    }
  }

  const asNumber = Number(trimmed);
  if (Number.isFinite(asNumber)) {
    return asNumber;
  }

  return null;
}

function normalize(input: string): string {
  let output = input
    .replace(/[\u2012\u2013\u2014\u2212]/g, "-")
    .replace(/\s+/g, " ")
    .trim();

  for (const [symbol, fraction] of Object.entries(FRACTION_MAP)) {
    output = output.replaceAll(symbol, ` ${fraction} `);
  }

  output = output
    .replace(/(\d)(tbsp|tsp|ml|kg|g|pcs?|pc)\b/gi, "$1 $2")
    .replace(/(\d+)\s*pcs?\b/gi, "$1 pieces");

  return output.replace(/\s+/g, " ").trim();
}

interface UnitMapping {
  pattern: RegExp;
  unit: Unit;
  isWholeItem: boolean;
}

const UNIT_MAPPINGS: UnitMapping[] = [
  { pattern: /^(tbsp|tablespoons?|tblsp)\b/i, unit: "TBSP", isWholeItem: false },
  { pattern: /^(tsp|teaspoons?)\b/i, unit: "TSP", isWholeItem: false },
  { pattern: /^(ml|millilit(?:er|re)s?)\b/i, unit: "ML", isWholeItem: false },
  { pattern: /^(g|gr|gram(?:s)?)\b/i, unit: "GRAM", isWholeItem: false },
  { pattern: /^(kg|kilogram(?:s)?)\b/i, unit: "KG", isWholeItem: false },
  { pattern: /^(pinch(?:es)?)\b/i, unit: "PINCH", isWholeItem: false },
  { pattern: /^(handful(?:s)?)\b/i, unit: "HANDFUL", isWholeItem: false },
  { pattern: /^(pcs?|pieces?)\b/i, unit: "UNIT", isWholeItem: true },
  {
    pattern: /^(eggs?|onions?|shallots?|potatoes?|carrots?|peppers?|tomatoes?|lemons?|limes?)\b/i,
    unit: "UNIT",
    isWholeItem: true
  },
  { pattern: /^(pieces?)\b/i, unit: "UNIT", isWholeItem: true }
];

function detectUnit(text: string): { unit: Unit | null; isWholeItem: boolean; remainder: string } {
  const trimmed = text.trim();

  for (const mapping of UNIT_MAPPINGS) {
    const match = trimmed.match(mapping.pattern);
    if (!match) {
      continue;
    }

    const remainder = trimmed.slice(match[0].length).trim();
    return {
      unit: mapping.unit,
      isWholeItem: mapping.isWholeItem,
      remainder
    };
  }

  return { unit: null, isWholeItem: false, remainder: trimmed };
}

function cleanIngredientName(input: string): string {
  return input
    .replace(/^[-*\u2022]\s*/, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function parseIngredientLine(line: string): ParsedQuantity {
  const normalized = normalize(line);
  const cleanedLine = cleanIngredientName(normalized);

  if (!cleanedLine) {
    return {
      name: "",
      quantityText: null,
      quantityValue: null,
      quantityMin: null,
      quantityMax: null,
      unit: null,
      isWholeItem: false
    };
  }

  if (/^(to taste|as needed|a pinch of)/i.test(cleanedLine)) {
    return {
      name: cleanedLine,
      quantityText: null,
      quantityValue: null,
      quantityMin: null,
      quantityMax: null,
      unit: null,
      isWholeItem: false
    };
  }

  const quantityMatch = cleanedLine.match(
    /^((?:\d+\s+\d+\/\d+|\d+\/\d+|\d+(?:\.\d+)?))(?:\s*[-]\s*((?:\d+\s+\d+\/\d+|\d+\/\d+|\d+(?:\.\d+)?)))?\s+(.+)$/
  );

  if (!quantityMatch) {
    return {
      name: cleanedLine,
      quantityText: null,
      quantityValue: null,
      quantityMin: null,
      quantityMax: null,
      unit: null,
      isWholeItem: false
    };
  }

  const [, firstToken, secondToken, rest] = quantityMatch;
  const quantityValue = decodeFractionToken(firstToken);
  const quantityMax = secondToken ? decodeFractionToken(secondToken) : null;
  const quantityMin = quantityValue;

  const unitResult = detectUnit(rest);

  let inferredWholeItem = unitResult.isWholeItem;
  if (!unitResult.unit && quantityValue !== null && Number.isInteger(quantityValue)) {
    inferredWholeItem = /\b(egg|eggs|onion|onions|potato|potatoes|clove|cloves)\b/i.test(
      unitResult.remainder
    );
  }

  return {
    name: cleanIngredientName(unitResult.remainder),
    quantityText: secondToken ? `${firstToken}-${secondToken}` : firstToken,
    quantityValue,
    quantityMin,
    quantityMax,
    unit: unitResult.unit,
    isWholeItem: inferredWholeItem
  };
}
