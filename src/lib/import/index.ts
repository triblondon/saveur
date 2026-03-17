import { extractRecipeDraftWithLlm } from "@/lib/import/llm-import";
import { createImportedRecipe, reimportRecipe, saveSourceSnapshot } from "@/lib/store";

interface ImportResult {
  recipeId: string;
  importRunId: string;
  status: "SUCCESS" | "PARTIAL" | "FAILED";
  usable: boolean;
  warnings: string[];
  adapter: string;
}

async function fetchHtml(url: string): Promise<string> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20_000);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        "user-agent": "SaveurBot/0.1 (+https://example.local)"
      }
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch source URL (${response.status})`);
    }

    const contentType = response.headers.get("content-type") ?? "";
    if (!contentType.includes("text/html")) {
      throw new Error(`Unsupported content-type: ${contentType || "unknown"}`);
    }

    return await response.text();
  } finally {
    clearTimeout(timeout);
  }
}

interface ImportFromUrlOptions {
  prompt?: string | null;
}

export async function importRecipeFromUrl(url: string, options?: ImportFromUrlOptions): Promise<ImportResult> {
  const html = await fetchHtml(url);
  const snapshot = await saveSourceSnapshot(url, html);
  const prompt = options?.prompt?.trim() || null;
  const { draft, model } = await extractRecipeDraftWithLlm({ url, html, prompt });

  const { recipe, importRun } = await createImportedRecipe({
    sourceUrl: url,
    adapterName: "llm-import",
    adapterVersion: model,
    snapshotId: snapshot.id,
    draft,
    importPrompt: prompt
  });

  return {
    recipeId: recipe.id,
    importRunId: importRun.id,
    status: importRun.status,
    usable: importRun.usable,
    warnings: draft.warnings,
    adapter: importRun.adapterName
  };
}

interface ReimportFromUrlOptions {
  recipeId: string;
  url: string;
  prompt?: string | null;
}

export async function reimportRecipeFromUrl(options: ReimportFromUrlOptions): Promise<ImportResult> {
  const html = await fetchHtml(options.url);
  const snapshot = await saveSourceSnapshot(options.url, html);
  const prompt = options.prompt?.trim() || null;
  const { draft, model } = await extractRecipeDraftWithLlm({
    url: options.url,
    html,
    prompt
  });

  const updated = await reimportRecipe({
    recipeId: options.recipeId,
    sourceUrl: options.url,
    adapterName: "llm-import",
    adapterVersion: model,
    snapshotId: snapshot.id,
    draft,
    importPrompt: prompt
  });

  if (!updated) {
    throw new Error("Recipe not found for reimport");
  }

  return {
    recipeId: updated.recipe.id,
    importRunId: updated.importRun.id,
    status: updated.importRun.status,
    usable: updated.importRun.usable,
    warnings: draft.warnings,
    adapter: updated.importRun.adapterName
  };
}
