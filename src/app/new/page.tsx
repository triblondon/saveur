import { redirect } from "next/navigation";
import { NewRecipeForm } from "@/components/NewRecipeForm";
import { getCurrentUser } from "@/lib/auth/current-user";
import { listWritableCollectionsForUser } from "@/lib/store";
import styles from "@/app/styles/page.module.css";

interface NewRecipePageProps {
  searchParams: Promise<{ collectionId?: string }>;
}

export default async function NewRecipePage({ searchParams }: NewRecipePageProps) {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/auth?next=/new");
  }
  const collections = await listWritableCollectionsForUser(user.id);
  if (collections.length === 0) {
    redirect("/collections");
  }
  const params = await searchParams;

  return (
    <section className={styles.page}>
      <h2 className={styles.heading}>New recipe</h2>
      <p className={`muted ${styles.description}`}>
        Manual entry supports prep tasks and timed cook steps.
      </p>
      <NewRecipeForm
        writableCollections={collections}
        initialCollectionId={params.collectionId && collections.some((entry) => entry.id === params.collectionId) ? params.collectionId : collections[0]?.id ?? ""}
      />
    </section>
  );
}
