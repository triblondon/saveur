import path from "node:path";
import { extractRecipeDraftWithLlm } from "@/lib/import/llm-import";
import { uploadObject } from "@/lib/object-storage";
import { createImportedRecipe, reimportRecipe, saveSourceSnapshot } from "@/lib/store";
import type { ParsedRecipeDraft } from "@/lib/import/types";

interface ImportResult {
  recipeId: string;
  importRunId: string;
  status: "SUCCESS" | "PARTIAL" | "FAILED";
  usable: boolean;
  warnings: string[];
  adapter: string;
}

const MAX_HERO_IMAGE_BYTES = 8 * 1024 * 1024;

function extensionForImage(contentType: string, sourceUrl: string): string {
  if (contentType === "image/jpeg") {
    return ".jpg";
  }
  if (contentType === "image/png") {
    return ".png";
  }
  if (contentType === "image/webp") {
    return ".webp";
  }
  if (contentType === "image/gif") {
    return ".gif";
  }

  try {
    const pathname = new URL(sourceUrl).pathname;
    const extension = path.extname(pathname);
    if (extension && /^[a-zA-Z0-9.]+$/.test(extension)) {
      return extension.toLowerCase();
    }
  } catch {
    // ignore URL parse failures and fallback
  }

  return ".img";
}

function appendWarning(draft: ParsedRecipeDraft, warning: string): void {
  if (!warning.trim()) {
    return;
  }

  if (!draft.warnings.includes(warning)) {
    draft.warnings.push(warning);
  }
}

async function persistImportedHeroPhoto(params: {
  heroPhotoUrl: string | null;
  storagePrefix: string;
  draft: ParsedRecipeDraft;
}): Promise<void> {
  const heroPhotoUrl = params.heroPhotoUrl?.trim();
  if (!heroPhotoUrl) {
    return;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20_000);

  try {
    const response = await fetch(heroPhotoUrl, {
      signal: controller.signal,
      headers: {
        "user-agent": "SaveurBot/0.1 (+https://example.local)"
      }
    });

    if (!response.ok) {
      appendWarning(params.draft, `Could not cache hero image (${response.status})`);
      return;
    }

    const contentType = (response.headers.get("content-type") ?? "")
      .split(";")[0]
      .trim()
      .toLowerCase();
    if (!contentType.startsWith("image/")) {
      appendWarning(params.draft, "Could not cache hero image (source was not an image)");
      return;
    }

    const bytes = Buffer.from(await response.arrayBuffer());
    if (bytes.length === 0) {
      appendWarning(params.draft, "Could not cache hero image (image was empty)");
      return;
    }

    if (bytes.length > MAX_HERO_IMAGE_BYTES) {
      appendWarning(params.draft, "Could not cache hero image (image exceeded size limit)");
      return;
    }

    const extension = extensionForImage(contentType, heroPhotoUrl);
    const storageKey = `${params.storagePrefix}${extension}`;
    const stored = await uploadObject({
      storageKey,
      body: bytes,
      contentType,
      cacheControlMaxAge: 31_536_000
    });

    if (!stored.publicUrl) {
      appendWarning(params.draft, "Could not cache hero image (no public URL after upload)");
      return;
    }

    params.draft.heroPhotoUrl = stored.publicUrl;
  } catch {
    appendWarning(params.draft, "Could not cache hero image");
  } finally {
    clearTimeout(timeout);
  }
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
  await persistImportedHeroPhoto({
    heroPhotoUrl: draft.heroPhotoUrl,
    storagePrefix: `photos/imports/${snapshot.id}/hero`,
    draft
  });

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
  await persistImportedHeroPhoto({
    heroPhotoUrl: draft.heroPhotoUrl,
    storagePrefix: `photos/imports/${snapshot.id}/hero`,
    draft
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
