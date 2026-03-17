import { getOpenApiDereferencedSchema } from "@/lib/openapi";
import { parseDurationSeconds } from "@/lib/parse/duration";
import type { ImportDraft } from "@/lib/types";
import { validateImportDraft } from "@/lib/validation";
import type { ParsedRecipeDraft } from "@/lib/import/types";

const MODEL_DEFAULT = "gpt-4.1";

function truncate(text: string, maxChars: number): string {
  if (text.length <= maxChars) {
    return text;
  }

  return `${text.slice(0, maxChars)}\n\n[truncated ${text.length - maxChars} chars]`;
}

async function fetchUrlMirrorMarkdown(url: string): Promise<string | null> {
  const endpoint = `https://r.jina.ai/http://${url}`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20_000);

  try {
    const response = await fetch(endpoint, {
      signal: controller.signal,
      headers: {
        "user-agent": "SaveurBot/0.1 (+https://example.local)"
      }
    });

    if (!response.ok) {
      return null;
    }

    const text = await response.text();
    if (!text.trim()) {
      return null;
    }

    const marker = "Markdown Content:";
    const markerIndex = text.indexOf(marker);
    const markdown = markerIndex >= 0 ? text.slice(markerIndex + marker.length) : text;

    return markdown.trim() || null;
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

function outputTextFromResponse(payload: unknown): string {
  if (!payload || typeof payload !== "object") {
    return "";
  }

  const root = payload as Record<string, unknown>;
  if (typeof root.output_text === "string" && root.output_text.trim()) {
    return root.output_text;
  }

  const output = root.output;
  if (!Array.isArray(output)) {
    return "";
  }

  const chunks: string[] = [];
  for (const item of output) {
    if (!item || typeof item !== "object") {
      continue;
    }

    const content = (item as Record<string, unknown>).content;
    if (!Array.isArray(content)) {
      continue;
    }

    for (const block of content) {
      if (!block || typeof block !== "object") {
        continue;
      }

      const text = (block as Record<string, unknown>).text;
      if (typeof text === "string" && text.trim()) {
        chunks.push(text);
      }
    }
  }

  return chunks.join("\n").trim();
}

function extractJsonObject(text: string): unknown {
  const trimmed = text.trim();
  if (!trimmed) {
    return null;
  }

  try {
    return JSON.parse(trimmed);
  } catch {
    const fenced = trimmed.match(/```json\s*([\s\S]*?)\s*```/i);
    if (fenced?.[1]) {
      try {
        return JSON.parse(fenced[1]);
      } catch {
        // continue
      }
    }

    const start = trimmed.indexOf("{");
    const end = trimmed.lastIndexOf("}");
    if (start >= 0 && end > start) {
      const candidate = trimmed.slice(start, end + 1);
      try {
        return JSON.parse(candidate);
      } catch {
        return null;
      }
    }

    return null;
  }
}

function normalizeOutput(output: ImportDraft): ParsedRecipeDraft {
  const prepTaskCount = output.prepTasks.length;

  const tags: string[] = [];
  const seenTags = new Set<string>();
  for (const tag of output.tags) {
    const trimmed = tag.trim();
    if (!trimmed) {
      continue;
    }

    const key = trimmed.toLowerCase();
    if (seenTags.has(key)) {
      continue;
    }

    seenTags.add(key);
    tags.push(trimmed);
  }

  const warnings = output.warnings.map((warning) => warning.trim()).filter(Boolean);

  return {
    title: output.title.trim(),
    description: output.description ? output.description.trim() : null,
    heroPhotoUrl: output.heroPhotoUrl,
    servingCount: output.servingCount,
    timeRequiredMinutes: output.timeRequiredMinutes,
    tags,
    ingredients: output.ingredients.map((ingredient) => ({
      name: ingredient.name.trim(),
      quantityText: ingredient.quantityText,
      quantityValue: ingredient.quantityValue,
      quantityMin: ingredient.quantityMin,
      quantityMax: ingredient.quantityMax,
      unit: ingredient.unit,
      isWholeItem: ingredient.isWholeItem,
      optional: ingredient.optional,
      isPantryItem: ingredient.isPantryItem
    })),
    prepTasks: output.prepTasks.map((task) => ({
      title: task.title.trim(),
      detail: task.detail ? task.detail.trim() : null
    })),
    cookSteps: output.cookSteps.map((step) => {
      const instruction = step.instruction.trim();
      const detail = step.detail ? step.detail.trim() : null;
      const inferredTimer = step.timerSeconds ?? parseDurationSeconds(`${instruction} ${detail ?? ""}`);

      return {
        instruction,
        detail,
        timerSeconds: inferredTimer,
        prepTaskRefs: step.prepTaskRefs.filter((index) => index >= 0 && index < prepTaskCount)
      };
    }),
    confidence: output.confidence,
    warnings
  };
}

interface ExtractRecipeDraftParams {
  url: string;
  html: string;
  prompt?: string | null;
}

interface ExtractRecipeDraftResult {
  draft: ParsedRecipeDraft;
  model: string;
}

export async function extractRecipeDraftWithLlm(
  params: ExtractRecipeDraftParams
): Promise<ExtractRecipeDraftResult> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is required for URL imports");
  }

  const model = process.env.OPENAI_IMPORT_MODEL ?? process.env.OPENAI_MODEL ?? MODEL_DEFAULT;
  const mirrorMarkdown = await fetchUrlMirrorMarkdown(params.url);
  const mirrorSnippet = mirrorMarkdown ? truncate(mirrorMarkdown, 32_000) : null;

  const prompt = [
    `Review the recipe at ${params.url}.`,
    "",
    "Rewrite this recipe, identifying key metadata and organising the main content as:",
    "",
    "1. Ingredients: Identify all listed ingredients, quantities, and units. Convert to one allowed unit enum value when possible. Mark pantry staples with isPantryItem=true.",
    "2. Prep tasks: A list of tasks that can be done to process/combine raw ingredients into as few as possible prepared ingredients. Prep tasks must avoid sequencing, timing, or heat-sensitive cooking. Making salads, chopping veg, making stocks or spice mixes, or combining ingredients that are ultimately added together in the same cook step are good candidates for prep tasks.",
    "3. Cooking steps: Ordered heat/time-sensitive steps that can't be done ahead of time, using ingredients prepped in the prep tasks.",
    "",
    "Use the source URL and extracted page content below. If the HTML is JS-heavy and sparse, use web search to read the page.",
    "",
    `SOURCE_URL:\n${params.url}`,
    "",
    mirrorSnippet
      ? `URL_MIRROR_MARKDOWN:\n${mirrorSnippet}`
      : "URL_MIRROR_MARKDOWN:\n[not available]",
    "",
    params.prompt?.trim()
      ? `CUSTOM_IMPORT_PROMPT:\n${params.prompt.trim()}`
      : "CUSTOM_IMPORT_PROMPT:\n[none]"
  ].join("\n");

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model,
      temperature: 0.1,
      max_output_tokens: 4_000,
      tools: [{ type: "web_search_preview" }],
      tool_choice: "auto",
      input: [
        {
          role: "system",
          content:
            "You are a precise recipe extraction engine. Return only valid JSON matching the required schema. Never invent ingredients. Preserve original step order in cooking steps."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      text: {
        format: {
          type: "json_schema",
          name: "saveur_recipe_import",
          strict: true,
          schema: getOpenApiDereferencedSchema("ImportDraft")
        }
      }
    })
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`OpenAI import request failed (${response.status}): ${body.slice(0, 220)}`);
  }

  const payload = (await response.json()) as unknown;
  const text = outputTextFromResponse(payload);
  const parsed = extractJsonObject(text);
  const validated = validateImportDraft(parsed);

  if (!validated.valid) {
    const issue = validated.issues[0];
    const path = issue?.instancePath || "/";
    throw new Error(`LLM import output validation failed: ${path} ${issue?.message ?? "invalid"}`);
  }

  return {
    draft: normalizeOutput(validated.value),
    model
  };
}
