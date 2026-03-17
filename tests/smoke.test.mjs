import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

test("core scaffold files exist", () => {
  assert.equal(existsSync("src/lib/import/llm-import.ts"), true);
  assert.equal(existsSync("src/app/api/import/url/route.ts"), true);
  assert.equal(existsSync("db/schema.sql"), true);
  assert.equal(existsSync("openapi/openapi.yaml"), true);
});

test("LLM importer uses schema and unit enums", () => {
  const source = readFileSync("src/lib/import/llm-import.ts", "utf8");
  assert.match(source, /json_schema/);
  assert.match(source, /getOpenApiDereferencedSchema\(\"ImportDraft\"\)/);
  assert.match(source, /web_search_preview/);
});

test("import prompt is wired from API through model and reimport flow", () => {
  const openApiSource = readFileSync("openapi/openapi.yaml", "utf8");
  const typesSource = readFileSync("src/lib/types.ts", "utf8");
  const importRouteSource = readFileSync("src/app/api/import/url/route.ts", "utf8");
  const reimportRouteSource = readFileSync("src/app/api/recipes/[id]/reimport/route.ts", "utf8");
  const importServiceSource = readFileSync("src/lib/import/index.ts", "utf8");
  const llmSource = readFileSync("src/lib/import/llm-import.ts", "utf8");

  assert.match(typesSource, /export type Recipe = components\[\"schemas\"\]\[\"Recipe\"\]/);
  assert.match(openApiSource, /importPrompt:/);
  assert.match(importRouteSource, /prompt:\s*payload\.prompt\s*\?\?\s*null/);
  assert.match(reimportRouteSource, /hasPromptField/);
  assert.match(reimportRouteSource, /prompt:\s*hasPromptField\s*\?\s*payload\.prompt\s*\?\?\s*null\s*:\s*recipe\.importPrompt\s*\?\?\s*null/);
  assert.match(importServiceSource, /extractRecipeDraftWithLlm\(\{\s*url,\s*html,\s*prompt\s*\}\)/s);
  assert.match(llmSource, /CUSTOM_IMPORT_PROMPT:/);
});
