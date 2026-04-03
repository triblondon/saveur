import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { EditRecipeForm } from "@/components/EditRecipeForm";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getRecipeByIdForUser, listWritableCollectionsForUser } from "@/lib/store";
import styles from "@/app/styles/page.module.css";

interface EditRecipePageProps {
  params: Promise<{ id: string }>;
}

export default async function EditRecipePage({ params }: EditRecipePageProps) {
  const resolved = await params;
  const user = await getCurrentUser();
  if (!user) {
    redirect(`/auth?next=/recipes/${resolved.id}/edit`);
  }

  const { id } = resolved;
  const recipe = await getRecipeByIdForUser(id, user.id);

  if (!recipe) {
    notFound();
  }

  const writableCollections = await listWritableCollectionsForUser(user.id);
  const writableCollectionIds = new Set(writableCollections.map((entry) => entry.id));
  if (!recipe.collectionId || !writableCollectionIds.has(recipe.collectionId)) {
    redirect(`/recipes/${recipe.id}`);
  }

  return (
    <section className={styles.page}>
      <h2 className={styles.heading}>Edit recipe</h2>
      <p className={`muted ${styles.description}`}>
        <Link className={styles.backLink} href={`/recipes/${recipe.id}`}>
          Back to recipe
        </Link>
      </p>
      <EditRecipeForm recipe={recipe} writableCollections={writableCollections} />
    </section>
  );
}
