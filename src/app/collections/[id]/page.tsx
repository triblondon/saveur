import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { HeroImagePlaceholder } from "@/components/HeroImagePlaceholder";
import { CollectionOwnerControls } from "@/components/CollectionOwnerControls";
import { getCurrentUser } from "@/lib/auth/current-user";
import {
  getCollectionDetailForUser,
  listWritableCollectionsForUser
} from "@/lib/store";
import homeStyles from "@/app/styles/home.module.css";
import styles from "@/app/styles/collections.module.css";

interface CollectionPageProps {
  params: Promise<{ id: string }>;
}

export default async function CollectionPage({ params }: CollectionPageProps) {
  const { id } = await params;
  const user = await getCurrentUser();
  const collection = await getCollectionDetailForUser(id, user?.id ?? null);

  if (!collection) {
    notFound();
  }

  const writableCollections =
    user && collection.role === "OWNER" ? await listWritableCollectionsForUser(user.id) : [];
  const roleLabel =
    collection.role === "OWNER"
      ? "Owned by you"
      : collection.role === "COLLABORATOR"
        ? "Collaborator access"
        : "Viewer access";

  return (
    <section className={styles.page}>
      <header className={styles.collectionHero}>
        <div className={styles.collectionHeroIntro}>
          <h2 className={styles.collectionHeroTitle}>{collection.name}</h2>
          <p className={`muted ${styles.collectionMeta}`}>
            {collection.visibility === "public" ? "Public (direct-link only)" : "Private"} · {roleLabel}
          </p>
          {collection.description ? (
            <p className={styles.collectionDescription}>{collection.description}</p>
          ) : null}
        </div>
        <div className={styles.collectionActionButtons}>
          {user ? (
            <>
              <Link
                href={`/new?collectionId=${collection.id}` as never}
                className={styles.collectionActionButton}
              >
                Add recipe
              </Link>
              <Link
                href={`/import?collectionId=${collection.id}` as never}
                className={styles.collectionActionButton}
              >
                Import recipe
              </Link>
            </>
          ) : null}
        </div>
      </header>

      {collection.recipes.length === 0 ? (
        <article className="card">
          <p className="muted">No recipes in this collection yet.</p>
          {user ? (
            <Link href={`/import?collectionId=${collection.id}` as never}>Import the first recipe</Link>
          ) : null}
        </article>
      ) : (
        <div className={homeStyles.recipeList}>
          {collection.recipes.map((recipe) => (
            <article className={`card ${homeStyles.recipeCard}`} key={recipe.id}>
              <Link className={homeStyles.heroLink} href={`/recipes/${recipe.id}`}>
                {recipe.heroPhotoUrl ? (
                  <Image
                    className={homeStyles.heroImage}
                    src={recipe.heroPhotoUrl}
                    alt={recipe.title}
                    width={1200}
                    height={680}
                  />
                ) : (
                  <HeroImagePlaceholder className={homeStyles.heroPlaceholder} />
                )}
                <span className={homeStyles.durationBadge}>
                  {recipe.timeRequiredMinutes ? `${recipe.timeRequiredMinutes} min` : "Time unknown"}
                </span>
              </Link>
              <h3 className={homeStyles.recipeTitle}>
                <Link className={homeStyles.recipeTitleLink} href={`/recipes/${recipe.id}`}>
                  {recipe.title}
                </Link>
              </h3>
            </article>
          ))}
        </div>
      )}

      {user && collection.role === "OWNER" ? (
        <CollectionOwnerControls collection={collection} writableCollections={writableCollections} />
      ) : null}
    </section>
  );
}
