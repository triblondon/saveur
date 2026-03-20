import { notFound } from "next/navigation";
import { RecipeView } from "@/components/RecipeView";
import { getImportRunById, getRecipeById } from "@/lib/store";

interface RecipePageProps {
  params: Promise<{ id: string }>;
}

export default async function RecipePage({ params }: RecipePageProps) {
  const { id } = await params;
  const recipe = await getRecipeById(id);

  if (!recipe) {
    notFound();
  }

  const latestImportWarnings = recipe.importRunId
    ? (await getImportRunById(recipe.importRunId))?.warnings ?? []
    : [];

  return <RecipeView recipe={recipe} latestImportWarnings={latestImportWarnings} />;
}
