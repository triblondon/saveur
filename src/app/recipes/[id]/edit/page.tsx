import Link from "next/link";
import { notFound } from "next/navigation";
import { EditRecipeForm } from "@/components/EditRecipeForm";
import { getRecipeById } from "@/lib/store";

interface EditRecipePageProps {
  params: Promise<{ id: string }>;
}

export default async function EditRecipePage({ params }: EditRecipePageProps) {
  const { id } = await params;
  const recipe = await getRecipeById(id);

  if (!recipe) {
    notFound();
  }

  return (
    <section>
      <h2 style={{ marginBottom: 8 }}>Edit recipe</h2>
      <p className="muted" style={{ marginTop: 0 }}>
        <Link href={`/recipes/${recipe.id}`}>Back to recipe</Link>
      </p>
      <EditRecipeForm recipe={recipe} />
    </section>
  );
}
