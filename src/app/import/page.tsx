import { redirect } from "next/navigation";
import { ImportUrlForm } from "@/components/ImportUrlForm";
import { getCurrentUser } from "@/lib/auth/current-user";
import { listWritableCollectionsForUser } from "@/lib/store";
import styles from "@/app/styles/page.module.css";

interface ImportPageProps {
  searchParams: Promise<{ collectionId?: string }>;
}

export default async function ImportPage({ searchParams }: ImportPageProps) {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/auth?next=/import");
  }
  const collections = await listWritableCollectionsForUser(user.id);
  if (collections.length === 0) {
    redirect("/collections");
  }
  const params = await searchParams;

  return (
    <section className={styles.page}>
      <h2 className={styles.heading}>Import from URL</h2>
      <p className={`muted ${styles.description}`}>
        LLM import supports recipe URLs from any source with schema-guided extraction.
      </p>
      <ImportUrlForm
        collections={collections}
        initialCollectionId={params.collectionId && collections.some((entry) => entry.id === params.collectionId) ? params.collectionId : collections[0]?.id ?? ""}
      />
    </section>
  );
}
