import { isDatabaseConfigured } from "@/lib/db";
import * as fileStore from "@/lib/store-file";
import * as postgresStore from "@/lib/store-postgres";
import type {
  CollectionAccess,
  CollectionCreateInput,
  CollectionDeleteOptions,
  CollectionDetail,
  CollectionRole,
  CollectionSummary,
  CollectionUpdateInput,
  ImportRun,
  Recipe,
  RecipeSummary,
  SourceSnapshot,
  UserSummary
} from "@/lib/types";
import type { ParsedRecipeDraft } from "@/lib/import/types";

type MemberRole = Exclude<CollectionRole, "OWNER">;

interface StoreBackend {
  getUserById: (id: string) => Promise<UserSummary | null>;
  getUserAuthByEmail: (email: string) => Promise<{
    id: string;
    name: string;
    email: string;
    passwordHash: string;
    createdAt: string;
    updatedAt: string;
  } | null>;
  createUser: (input: { name: string; email: string; passwordHash: string }) => Promise<UserSummary>;

  createCollection: (ownerUserId: string, input: CollectionCreateInput) => Promise<{
    id: string;
    ownerUserId: string;
    name: string;
    description: string | null;
    visibility: "public" | "private";
    createdAt: string;
    updatedAt: string;
  }>;
  updateCollection: (
    collectionId: string,
    input: CollectionUpdateInput
  ) => Promise<{
    id: string;
    ownerUserId: string;
    name: string;
    description: string | null;
    visibility: "public" | "private";
    createdAt: string;
    updatedAt: string;
  } | null>;
  getCollectionById: (collectionId: string) => Promise<{
    id: string;
    ownerUserId: string;
    name: string;
    description: string | null;
    visibility: "public" | "private";
    createdAt: string;
    updatedAt: string;
  } | null>;
  listCollections: () => Promise<
    Array<{
      id: string;
      ownerUserId: string;
      name: string;
      description: string | null;
      visibility: "public" | "private";
      createdAt: string;
      updatedAt: string;
    }>
  >;
  listCollectionMembers: (collectionId: string) => Promise<
    Array<{
      collectionId: string;
      userId: string;
      role: MemberRole;
      createdAt: string;
    }>
  >;
  upsertCollectionMember: (collectionId: string, userId: string, role: MemberRole) => Promise<void>;
  removeCollectionMember: (collectionId: string, userId: string) => Promise<void>;
  deleteCollection: (collectionId: string) => Promise<void>;
  moveRecipesBetweenCollections: (sourceCollectionId: string, targetCollectionId: string) => Promise<void>;
  deleteRecipesByCollection: (collectionId: string) => Promise<void>;

  listRecipeSummaries: (query?: string) => Promise<RecipeSummary[]>;
  listRecipes: (query?: string) => Promise<Recipe[]>;
  listRecipesByCollection: (collectionId: string) => Promise<Recipe[]>;
  getRecipeById: (id: string) => Promise<Recipe | null>;
  getImportRunById: (id: string) => Promise<ImportRun | null>;
  createManualRecipe: (input: ManualRecipeInput & {
    createdByUserId: string | null;
    collectionId: string;
  }) => Promise<Recipe>;
  updateRecipe: (id: string, updates: Partial<Omit<Recipe, "id" | "createdAt">>) => Promise<Recipe | null>;
  deleteRecipe: (id: string) => Promise<boolean>;
  saveSourceSnapshot: (sourceUrl: string, html: string) => Promise<SourceSnapshot>;
  createImportedRecipe: (input: {
    sourceUrl: string;
    adapterName: string;
    adapterVersion: string;
    snapshotId: string | null;
    draft: ParsedRecipeDraft;
    importPrompt?: string | null;
    createdByUserId: string | null;
    collectionId: string;
  }) => Promise<{ recipe: Recipe; importRun: ImportRun }>;
  reimportRecipe: (input: {
    recipeId: string;
    sourceUrl: string;
    adapterName: string;
    adapterVersion: string;
    snapshotId: string | null;
    draft: ParsedRecipeDraft;
    importPrompt?: string | null;
  }) => Promise<{ recipe: Recipe; importRun: ImportRun } | null>;
}

type CollectionRecord = Awaited<ReturnType<StoreBackend["getCollectionById"]>> extends infer T
  ? NonNullable<T>
  : never;
type CollectionMemberRecord = Awaited<ReturnType<StoreBackend["listCollectionMembers"]>>[number];

export type ManualRecipeInput = fileStore.ManualRecipeInput;

const backend: StoreBackend = isDatabaseConfigured() ? postgresStore : fileStore;

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function sortByUpdatedDesc<T extends { updatedAt: string }>(values: T[]): T[] {
  return [...values].sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
}

async function resolveRoleForCollection(
  collection: CollectionRecord,
  userId: string | null
): Promise<CollectionRole | null> {
  if (!userId) {
    return null;
  }

  if (collection.ownerUserId === userId) {
    return "OWNER";
  }

  const members = await backend.listCollectionMembers(collection.id);
  const membership = members.find((entry) => entry.userId === userId);
  if (!membership) {
    return null;
  }

  return membership.role;
}

function computeAccess(collection: CollectionRecord, role: CollectionRole | null): CollectionAccess {
  const canRead = Boolean(role) || collection.visibility === "public";
  const canWriteRecipes = role === "OWNER" || role === "COLLABORATOR";
  const canManageCollection = role === "OWNER";

  return {
    collection: {
      id: collection.id,
      ownerUserId: collection.ownerUserId,
      visibility: collection.visibility
    },
    role,
    canRead,
    canWriteRecipes,
    canManageCollection
  };
}

async function membersWithUsers(collectionId: string): Promise<{
  collaborators: UserSummary[];
  viewers: UserSummary[];
}> {
  const members = await backend.listCollectionMembers(collectionId);
  const users = await Promise.all(members.map((member) => backend.getUserById(member.userId)));
  const byRole: { collaborators: UserSummary[]; viewers: UserSummary[] } = {
    collaborators: [],
    viewers: []
  };

  members.forEach((member, index) => {
    const user = users[index];
    if (!user) {
      return;
    }
    if (member.role === "COLLABORATOR") {
      byRole.collaborators.push(user);
    } else {
      byRole.viewers.push(user);
    }
  });

  return byRole;
}

async function buildCollectionSummary(
  collection: CollectionRecord,
  role: CollectionRole,
  recipeCount: number
): Promise<CollectionSummary> {
  const memberUsers = await membersWithUsers(collection.id);
  return {
    id: collection.id,
    name: collection.name,
    description: collection.description,
    visibility: collection.visibility,
    ownerUserId: collection.ownerUserId,
    role,
    recipeCount,
    updatedAt: collection.updatedAt,
    collaborators: memberUsers.collaborators,
    viewers: memberUsers.viewers
  };
}

async function requireCollectionAccess(collectionId: string, userId: string | null): Promise<CollectionAccess | null> {
  const collection = await backend.getCollectionById(collectionId);
  if (!collection) {
    return null;
  }

  const role = await resolveRoleForCollection(collection, userId);
  return computeAccess(collection, role);
}

async function recipeReadableByUser(recipe: Recipe, userId: string | null): Promise<boolean> {
  if (!recipe.collectionId) {
    return false;
  }
  const access = await requireCollectionAccess(recipe.collectionId, userId);
  return Boolean(access?.canRead);
}

async function recipeWritableByUser(recipe: Recipe, userId: string): Promise<boolean> {
  if (!recipe.collectionId) {
    return false;
  }
  const access = await requireCollectionAccess(recipe.collectionId, userId);
  return Boolean(access?.canWriteRecipes);
}

function normalizeCollectionInput(input: CollectionCreateInput | CollectionUpdateInput): CollectionCreateInput {
  const trimmedName = input.name.trim();
  if (!trimmedName) {
    throw new Error("Collection name is required");
  }
  if (trimmedName.length > 120) {
    throw new Error("Collection name is too long");
  }
  return {
    name: trimmedName,
    description: input.description?.trim() ? input.description.trim() : null,
    visibility: input.visibility === "public" ? "public" : "private"
  };
}

export async function getUserById(id: string): Promise<UserSummary | null> {
  return backend.getUserById(id);
}

export async function getUserAuthByEmail(email: string): Promise<{
  id: string;
  name: string;
  email: string;
  passwordHash: string;
  createdAt: string;
  updatedAt: string;
} | null> {
  return backend.getUserAuthByEmail(normalizeEmail(email));
}

export async function createUser(input: {
  name: string;
  email: string;
  passwordHash: string;
}): Promise<UserSummary> {
  const name = input.name.trim();
  if (!name) {
    throw new Error("Name is required");
  }
  const email = normalizeEmail(input.email);
  if (!email || !email.includes("@")) {
    throw new Error("Valid email is required");
  }
  const created = await backend.createUser({
    name,
    email,
    passwordHash: input.passwordHash
  });
  await ensureDefaultCollectionForUser(created.id);
  return created;
}

export async function ensureDefaultCollectionForUser(userId: string): Promise<CollectionSummary> {
  const collections = await listCollectionsForUser(userId);
  const existingOwner = collections.find((collection) => collection.role === "OWNER");
  if (existingOwner) {
    return existingOwner;
  }

  const created = await backend.createCollection(userId, {
    name: "My recipes",
    description: "Default collection",
    visibility: "private"
  });
  return buildCollectionSummary(created, "OWNER", 0);
}

export async function getCollectionAccess(collectionId: string, userId: string | null): Promise<CollectionAccess | null> {
  return requireCollectionAccess(collectionId, userId);
}

export async function listCollectionsForUser(userId: string): Promise<CollectionSummary[]> {
  const collections = await backend.listCollections();
  const list: CollectionSummary[] = [];
  for (const collection of collections) {
    const role = await resolveRoleForCollection(collection, userId);
    if (!role) {
      continue;
    }
    const recipeCount = (await backend.listRecipesByCollection(collection.id)).length;
    list.push(await buildCollectionSummary(collection, role, recipeCount));
  }
  return sortByUpdatedDesc(list);
}

export async function listWritableCollectionsForUser(userId: string): Promise<CollectionSummary[]> {
  const collections = await listCollectionsForUser(userId);
  return collections.filter((collection) => collection.role === "OWNER" || collection.role === "COLLABORATOR");
}

export async function getCollectionDetailForUser(
  collectionId: string,
  userId: string | null
): Promise<CollectionDetail | null> {
  const collection = await backend.getCollectionById(collectionId);
  if (!collection) {
    return null;
  }
  const role = await resolveRoleForCollection(collection, userId);
  const access = computeAccess(collection, role);
  if (!access.canRead) {
    return null;
  }

  const recipes = (await backend.listRecipesByCollection(collectionId)).map((recipe) => ({
    id: recipe.id,
    title: recipe.title,
    heroPhotoUrl: recipe.heroPhotoUrl,
    timeRequiredMinutes: recipe.timeRequiredMinutes,
    servingCount: recipe.servingCount,
    sourceType: recipe.sourceType,
    tags: recipe.tags,
    updatedAt: recipe.updatedAt,
    collectionId: recipe.collectionId
  }));

  const summary = await buildCollectionSummary(collection, role ?? "VIEWER", recipes.length);
  return {
    ...summary,
    role: role ?? "VIEWER",
    recipes
  };
}

export async function createCollectionForUser(
  ownerUserId: string,
  input: CollectionCreateInput
): Promise<CollectionSummary> {
  const collection = await backend.createCollection(ownerUserId, normalizeCollectionInput(input));
  return buildCollectionSummary(collection, "OWNER", 0);
}

export async function updateCollectionForUser(
  ownerUserId: string,
  collectionId: string,
  input: CollectionUpdateInput
): Promise<CollectionSummary | null> {
  const collection = await backend.getCollectionById(collectionId);
  if (!collection || collection.ownerUserId !== ownerUserId) {
    return null;
  }

  const updated = await backend.updateCollection(collectionId, normalizeCollectionInput(input));
  if (!updated) {
    return null;
  }
  const recipeCount = (await backend.listRecipesByCollection(collectionId)).length;
  return buildCollectionSummary(updated, "OWNER", recipeCount);
}

export async function addCollectionMemberByEmail(
  ownerUserId: string,
  collectionId: string,
  email: string,
  role: MemberRole
): Promise<CollectionDetail | null> {
  const collection = await backend.getCollectionById(collectionId);
  if (!collection || collection.ownerUserId !== ownerUserId) {
    return null;
  }

  const user = await backend.getUserAuthByEmail(normalizeEmail(email));
  if (!user) {
    throw new Error("USER_NOT_FOUND");
  }
  if (user.id === ownerUserId) {
    throw new Error("OWNER_CANNOT_BE_MEMBER");
  }
  await backend.upsertCollectionMember(collectionId, user.id, role);
  return getCollectionDetailForUser(collectionId, ownerUserId);
}

export async function removeCollectionMemberForOwner(
  ownerUserId: string,
  collectionId: string,
  memberUserId: string
): Promise<CollectionDetail | null> {
  const collection = await backend.getCollectionById(collectionId);
  if (!collection || collection.ownerUserId !== ownerUserId) {
    return null;
  }
  await backend.removeCollectionMember(collectionId, memberUserId);
  return getCollectionDetailForUser(collectionId, ownerUserId);
}

export async function deleteCollectionForOwner(
  ownerUserId: string,
  collectionId: string,
  options: CollectionDeleteOptions
): Promise<boolean> {
  const collection = await backend.getCollectionById(collectionId);
  if (!collection || collection.ownerUserId !== ownerUserId) {
    return false;
  }

  if (options.mode === "DELETE_RECIPES") {
    await backend.deleteRecipesByCollection(collectionId);
    await backend.deleteCollection(collectionId);
    return true;
  }

  const targetCollectionId = options.targetCollectionId?.trim();
  if (!targetCollectionId || targetCollectionId === collectionId) {
    throw new Error("Target collection is required");
  }

  const targetAccess = await requireCollectionAccess(targetCollectionId, ownerUserId);
  if (!targetAccess?.canWriteRecipes) {
    throw new Error("No write access to target collection");
  }

  await backend.moveRecipesBetweenCollections(collectionId, targetCollectionId);
  await backend.deleteCollection(collectionId);
  return true;
}

export async function listRecipeSummariesForUser(userId: string, query?: string): Promise<RecipeSummary[]> {
  const collections = await listCollectionsForUser(userId);
  const allowedCollectionIds = new Set(collections.map((collection) => collection.id));
  const recipes = await backend.listRecipeSummaries(query);
  return recipes.filter((recipe) => recipe.collectionId && allowedCollectionIds.has(recipe.collectionId));
}

export async function listRecipeSummariesPublic(query?: string): Promise<RecipeSummary[]> {
  const recipes = await backend.listRecipeSummaries(query);
  const collections = await backend.listCollections();
  const publicCollectionIds = new Set(
    collections.filter((collection) => collection.visibility === "public").map((collection) => collection.id)
  );
  return recipes.filter((recipe) => recipe.collectionId && publicCollectionIds.has(recipe.collectionId));
}

export async function listCollectionPreviewsForHome(userId: string, maxRecipesPerCollection = 6): Promise<
  Array<{
    collection: CollectionSummary;
    recipes: RecipeSummary[];
  }>
> {
  const collections = await listCollectionsForUser(userId);
  const ranked = [...collections].sort((left, right) => {
    const rank = (role: CollectionRole) => {
      if (role === "OWNER") return 0;
      if (role === "COLLABORATOR") return 1;
      return 2;
    };
    const rankDiff = rank(left.role) - rank(right.role);
    if (rankDiff !== 0) {
      return rankDiff;
    }
    return right.updatedAt.localeCompare(left.updatedAt);
  });

  const output: Array<{ collection: CollectionSummary; recipes: RecipeSummary[] }> = [];
  for (const collection of ranked) {
    const recipes = (await backend.listRecipesByCollection(collection.id))
      .map((recipe) => ({
        id: recipe.id,
        title: recipe.title,
        heroPhotoUrl: recipe.heroPhotoUrl,
        timeRequiredMinutes: recipe.timeRequiredMinutes,
        servingCount: recipe.servingCount,
        sourceType: recipe.sourceType,
        tags: recipe.tags,
        updatedAt: recipe.updatedAt,
        collectionId: recipe.collectionId
      }))
      .slice(0, maxRecipesPerCollection);
    output.push({
      collection,
      recipes
    });
  }

  return output;
}

export async function listRecipesForUser(userId: string, query?: string): Promise<Recipe[]> {
  const collections = await listCollectionsForUser(userId);
  const allowedCollectionIds = new Set(collections.map((collection) => collection.id));
  const recipes = await backend.listRecipes(query);
  return recipes.filter((recipe) => recipe.collectionId && allowedCollectionIds.has(recipe.collectionId));
}

export async function getRecipeByIdForUser(id: string, userId: string | null): Promise<Recipe | null> {
  const recipe = await backend.getRecipeById(id);
  if (!recipe) {
    return null;
  }
  if (!(await recipeReadableByUser(recipe, userId))) {
    return null;
  }
  return recipe;
}

export async function getImportRunById(id: string): Promise<ImportRun | null> {
  return backend.getImportRunById(id);
}

export async function createManualRecipeForUser(input: {
  userId: string;
  collectionId: string;
  recipe: ManualRecipeInput;
}): Promise<Recipe> {
  const access = await requireCollectionAccess(input.collectionId, input.userId);
  if (!access?.canWriteRecipes) {
    throw new Error("No write access to collection");
  }
  return backend.createManualRecipe({
    ...input.recipe,
    createdByUserId: input.userId,
    collectionId: input.collectionId
  });
}

export async function updateRecipeForUser(
  userId: string,
  id: string,
  updates: Partial<Omit<Recipe, "id" | "createdAt">>
): Promise<Recipe | null> {
  const existing = await backend.getRecipeById(id);
  if (!existing) {
    return null;
  }
  if (!(await recipeWritableByUser(existing, userId))) {
    throw new Error("No write access to recipe");
  }

  if (updates.collectionId && updates.collectionId !== existing.collectionId) {
    const targetAccess = await requireCollectionAccess(updates.collectionId, userId);
    if (!targetAccess?.canWriteRecipes) {
      throw new Error("No write access to destination collection");
    }
  }
  return backend.updateRecipe(id, updates);
}

export async function deleteRecipeForUser(userId: string, id: string): Promise<boolean> {
  const existing = await backend.getRecipeById(id);
  if (!existing) {
    return false;
  }
  if (!(await recipeWritableByUser(existing, userId))) {
    throw new Error("No write access to recipe");
  }
  return backend.deleteRecipe(id);
}

export async function saveSourceSnapshot(sourceUrl: string, html: string): Promise<SourceSnapshot> {
  return backend.saveSourceSnapshot(sourceUrl, html);
}

export async function createImportedRecipeForUser(input: {
  sourceUrl: string;
  adapterName: string;
  adapterVersion: string;
  snapshotId: string | null;
  draft: ParsedRecipeDraft;
  importPrompt?: string | null;
  userId: string;
  collectionId: string;
}): Promise<{ recipe: Recipe; importRun: ImportRun }> {
  const access = await requireCollectionAccess(input.collectionId, input.userId);
  if (!access?.canWriteRecipes) {
    throw new Error("No write access to collection");
  }
  return backend.createImportedRecipe({
    sourceUrl: input.sourceUrl,
    adapterName: input.adapterName,
    adapterVersion: input.adapterVersion,
    snapshotId: input.snapshotId,
    draft: input.draft,
    importPrompt: input.importPrompt,
    createdByUserId: input.userId,
    collectionId: input.collectionId
  });
}

export async function reimportRecipeForUser(input: {
  userId: string;
  recipeId: string;
  sourceUrl: string;
  adapterName: string;
  adapterVersion: string;
  snapshotId: string | null;
  draft: ParsedRecipeDraft;
  importPrompt?: string | null;
}): Promise<{ recipe: Recipe; importRun: ImportRun } | null> {
  const existing = await backend.getRecipeById(input.recipeId);
  if (!existing) {
    return null;
  }
  if (!(await recipeWritableByUser(existing, input.userId))) {
    throw new Error("No write access to recipe");
  }
  return backend.reimportRecipe({
    recipeId: input.recipeId,
    sourceUrl: input.sourceUrl,
    adapterName: input.adapterName,
    adapterVersion: input.adapterVersion,
    snapshotId: input.snapshotId,
    draft: input.draft,
    importPrompt: input.importPrompt
  });
}
