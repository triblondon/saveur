import { notFound } from "next/navigation";
import { RecipeView } from "@/components/RecipeView";
import { getCurrentUser } from "@/lib/auth/current-user";
import {
  getCollectionDetailForUser,
  getImportRunById,
  getRecipeByIdForUser
} from "@/lib/store";

interface RecipePageProps {
  params: Promise<{ id: string }>;
}

export default async function RecipePage({ params }: RecipePageProps) {
  const { id } = await params;
  const user = await getCurrentUser();
  const recipe = await getRecipeByIdForUser(id, user?.id ?? null);

  if (!recipe) {
    notFound();
  }

  const latestImportWarnings = recipe.importRunId
    ? (await getImportRunById(recipe.importRunId))?.warnings ?? []
    : [];
  const collection = recipe.collectionId
    ? await getCollectionDetailForUser(recipe.collectionId, user?.id ?? null)
    : null;

  return (
    <RecipeView
      recipe={recipe}
      latestImportWarnings={latestImportWarnings}
      collection={collection ? { id: collection.id, name: collection.name } : null}
      canEdit={Boolean(user && collection && (collection.role === "OWNER" || collection.role === "COLLABORATOR"))}
    />
  );
}
