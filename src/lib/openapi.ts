import { readFileSync } from "node:fs";
import path from "node:path";
import YAML from "yaml";
import type { components } from "@/generated/openapi";

type SchemaMap = Record<string, unknown>;
type SchemaName = keyof components["schemas"];

interface OpenApiLike {
  components: {
    schemas: SchemaMap;
  };
}

const openApiPath = path.join(process.cwd(), "openapi", "openapi.yaml");
const openApiSource = readFileSync(openApiPath, "utf8");
const documentRoot = YAML.parse(openApiSource) as OpenApiLike;

function cloneDeep<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function resolvePointer(root: unknown, pointer: string): unknown {
  const tokens = pointer
    .split("/")
    .slice(1)
    .map((token) => token.replace(/~1/g, "/").replace(/~0/g, "~"));

  let current: unknown = root;
  for (const token of tokens) {
    if (!current || typeof current !== "object" || !(token in (current as Record<string, unknown>))) {
      throw new Error(`Invalid OpenAPI pointer: ${pointer}`);
    }

    current = (current as Record<string, unknown>)[token];
  }

  return current;
}

function dereferenceNode(node: unknown, root: unknown): unknown {
  if (Array.isArray(node)) {
    return node.map((entry) => dereferenceNode(entry, root));
  }

  if (!node || typeof node !== "object") {
    return node;
  }

  const record = node as Record<string, unknown>;
  if (typeof record.$ref === "string" && record.$ref.startsWith("#/")) {
    return dereferenceNode(resolvePointer(root, record.$ref), root);
  }

  const output: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(record)) {
    output[key] = dereferenceNode(value, root);
  }

  return output;
}

function deepMergeSchemas(left: Record<string, unknown>, right: Record<string, unknown>): Record<string, unknown> {
  const merged: Record<string, unknown> = { ...left };

  for (const [key, rightValue] of Object.entries(right)) {
    const leftValue = merged[key];

    if (key === "required" && Array.isArray(leftValue) && Array.isArray(rightValue)) {
      merged[key] = Array.from(new Set([...leftValue, ...rightValue]));
      continue;
    }

    if (isRecord(leftValue) && isRecord(rightValue)) {
      merged[key] = deepMergeSchemas(leftValue, rightValue);
      continue;
    }

    merged[key] = rightValue;
  }

  return merged;
}

function resolveAllOfDeep(node: unknown): unknown {
  if (Array.isArray(node)) {
    return node.map((entry) => resolveAllOfDeep(entry));
  }

  if (!isRecord(node)) {
    return node;
  }

  const currentEntries = Object.entries(node).filter(([key]) => key !== "allOf");
  const current: Record<string, unknown> = {};
  for (const [key, value] of currentEntries) {
    current[key] = resolveAllOfDeep(value);
  }

  const allOf = node.allOf;
  if (!Array.isArray(allOf)) {
    return current;
  }

  let merged: Record<string, unknown> = {};
  for (const part of allOf) {
    const resolvedPart = resolveAllOfDeep(part);
    if (isRecord(resolvedPart)) {
      merged = deepMergeSchemas(merged, resolvedPart);
    }
  }

  return deepMergeSchemas(merged, current);
}

export function getOpenApiSchema(name: SchemaName): Record<string, unknown> {
  const schema = documentRoot.components.schemas[name as string];
  if (!schema || typeof schema !== "object") {
    throw new Error(`Missing OpenAPI schema: ${String(name)}`);
  }

  return cloneDeep(schema as Record<string, unknown>);
}

export function getOpenApiRefSchema(name: SchemaName): Record<string, unknown> {
  return {
    $ref: `#/components/schemas/${String(name)}`,
    components: cloneDeep(documentRoot.components)
  };
}

export function getOpenApiDereferencedSchema(name: SchemaName): Record<string, unknown> {
  const refSchema = getOpenApiRefSchema(name);
  const dereferenced = dereferenceNode(refSchema, refSchema);
  const merged = resolveAllOfDeep(dereferenced);

  if (!merged || typeof merged !== "object") {
    throw new Error(`Failed to dereference OpenAPI schema: ${String(name)}`);
  }

  return merged as Record<string, unknown>;
}
