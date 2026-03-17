import { notFound } from "next/navigation";
import { RecipeView } from "@/components/RecipeView";
import { getRecipeById } from "@/lib/store";

interface RecipePageProps {
  params: Promise<{ id: string }>;
}

export default async function RecipePage({ params }: RecipePageProps) {
  const { id } = await params;
  const recipe = await getRecipeById(id);

  if (!recipe) {
    notFound();
  }

  return <RecipeView recipe={recipe} />;
}
