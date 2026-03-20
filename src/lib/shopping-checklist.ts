const STORAGE_KEY = "saveur-shopping-checklist-v1";
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

interface ShoppingChecklistEntry {
  checkedKeys: string[];
  updatedAtMs: number;
}

type ShoppingChecklistStore = Record<string, ShoppingChecklistEntry>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function normalizeCheckedKeys(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return Array.from(
    new Set(
      value
        .filter((item): item is string => typeof item === "string")
        .map((item) => item.trim())
        .filter(Boolean)
    )
  );
}

function parseStore(raw: string | null): ShoppingChecklistStore {
  if (!raw) {
    return {};
  }

  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!isRecord(parsed)) {
      return {};
    }

    const store: ShoppingChecklistStore = {};
    for (const [recipeId, value] of Object.entries(parsed)) {
      if (!isRecord(value)) {
        continue;
      }

      const checkedKeys = normalizeCheckedKeys(value.checkedKeys);
      const updatedAtMs = Number(value.updatedAtMs);
      if (!Number.isFinite(updatedAtMs) || checkedKeys.length === 0) {
        continue;
      }

      store[recipeId] = {
        checkedKeys,
        updatedAtMs
      };
    }

    return store;
  } catch {
    return {};
  }
}

function pruneStore(store: ShoppingChecklistStore, nowMs: number): ShoppingChecklistStore {
  const next: ShoppingChecklistStore = {};

  for (const [recipeId, entry] of Object.entries(store)) {
    if (entry.checkedKeys.length === 0) {
      continue;
    }

    if (nowMs - entry.updatedAtMs > MAX_AGE_MS) {
      continue;
    }

    next[recipeId] = entry;
  }

  return next;
}

function storesEqual(left: ShoppingChecklistStore, right: ShoppingChecklistStore): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

function readStoreWithCleanup(nowMs: number): ShoppingChecklistStore {
  if (typeof window === "undefined") {
    return {};
  }

  const parsed = parseStore(window.localStorage.getItem(STORAGE_KEY));
  const pruned = pruneStore(parsed, nowMs);

  if (!storesEqual(parsed, pruned)) {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(pruned));
  }

  return pruned;
}

export function loadShoppingChecklist(recipeId: string): string[] {
  const store = readStoreWithCleanup(Date.now());
  return store[recipeId]?.checkedKeys ?? [];
}

export function saveShoppingChecklist(recipeId: string, checkedKeys: string[]): void {
  if (typeof window === "undefined") {
    return;
  }

  const nowMs = Date.now();
  const store = readStoreWithCleanup(nowMs);
  const normalized = normalizeCheckedKeys(checkedKeys);

  if (normalized.length === 0) {
    delete store[recipeId];
  } else {
    store[recipeId] = {
      checkedKeys: normalized,
      updatedAtMs: nowMs
    };
  }

  const pruned = pruneStore(store, nowMs);
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(pruned));
}

export function clearShoppingChecklist(recipeId: string): void {
  saveShoppingChecklist(recipeId, []);
}
