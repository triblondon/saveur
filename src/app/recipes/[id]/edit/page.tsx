import Link from "next/link";
import { notFound } from "next/navigation";
import { EditRecipeForm } from "@/components/EditRecipeForm";
import { getRecipeById } from "@/lib/store";
import styles from "@/app/styles/page.module.css";

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
    <section className={styles.page}>
      <h2 className={styles.heading}>Edit recipe</h2>
      <p className={`muted ${styles.description}`}>
        <Link className={styles.backLink} href={`/recipes/${recipe.id}`}>
          Back to recipe
        </Link>
      </p>
      <EditRecipeForm recipe={recipe} />
    </section>
  );
}
