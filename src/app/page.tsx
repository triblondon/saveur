import Link from "next/link";
import Image from "next/image";
import { HeroImagePlaceholder } from "@/components/HeroImagePlaceholder";
import { AppLogo } from "@/components/AppLogo";
import { getCurrentUser } from "@/lib/auth/current-user";
import {
  listCollectionPreviewsForHome,
  listCollectionsForUser,
  listRecipeSummariesForUser
} from "@/lib/store";
import styles from "@/app/styles/home.module.css";

interface HomeProps {
  searchParams: Promise<{ q?: string }>;
}

function roleRank(role: "OWNER" | "COLLABORATOR" | "VIEWER"): number {
  if (role === "OWNER") return 0;
  if (role === "COLLABORATOR") return 1;
  return 2;
}

export default async function Home({ searchParams }: HomeProps) {
  const user = await getCurrentUser();
  const params = await searchParams;
  const query = params.q?.trim() ?? "";

  if (!user) {
    return (
      <section className={styles.loggedOutShell}>
        <article className={styles.loggedOutHero}>
          <AppLogo iconSize={66} textClassName={styles.loggedOutWordmark} />
          <p className={`muted ${styles.loggedOutLead}`}>
            Private collections, shared cookbooks, and clean recipe views.
          </p>
          <Link href="/auth" className={styles.authCta}>
            Sign in or register
          </Link>
        </article>
      </section>
    );
  }

  const grouped =
    query.length > 0
      ? await (async () => {
          const [collections, recipes] = await Promise.all([
            listCollectionsForUser(user.id),
            listRecipeSummariesForUser(user.id, query)
          ]);
          const byCollectionId = new Map<string, typeof recipes>();
          for (const recipe of recipes) {
            if (!recipe.collectionId) {
              continue;
            }
            const current = byCollectionId.get(recipe.collectionId) ?? [];
            current.push(recipe);
            byCollectionId.set(recipe.collectionId, current);
          }
          return collections
            .filter((collection) => byCollectionId.has(collection.id))
            .sort((left, right) => {
              const rankDiff = roleRank(left.role) - roleRank(right.role);
              if (rankDiff !== 0) {
                return rankDiff;
              }
              return right.updatedAt.localeCompare(left.updatedAt);
            })
            .map((collection) => ({
              collection,
              recipes: (byCollectionId.get(collection.id) ?? []).slice(0, 6)
            }));
        })()
      : await listCollectionPreviewsForHome(user.id, 6);

  return (
    <section className={styles.page}>
      <form className={styles.searchCard} action="/" method="GET">
        <div className={styles.searchRow}>
          <div className={styles.searchInputWrap}>
            <input
              className={styles.searchInput}
              id="q"
              name="q"
              placeholder="Search your recipes"
              aria-label="Search your recipes"
              defaultValue={query}
            />
            {query ? (
              <Link className={styles.clearIcon} href="/" aria-label="Clear search">
                ×
              </Link>
            ) : null}
          </div>
          <button className={styles.searchButton} type="submit">
            Search
          </button>
        </div>
      </form>

      {grouped.length === 0 ? (
        <p className={`muted ${styles.empty}`}>No recipes found yet.</p>
      ) : (
        <div className={styles.collectionList}>
          {grouped.map(({ collection, recipes }) => (
            <section key={collection.id} className={styles.collectionSection}>
              <div className={styles.collectionHeader}>
                <h2 className={styles.collectionTitle}>
                  <Link href={`/collections/${collection.id}`}>{collection.name}</Link>
                </h2>
                <span className="muted">
                  {collection.role === "OWNER"
                    ? "Owned by you"
                    : collection.role === "COLLABORATOR"
                      ? "Collaborator"
                      : "Viewer"}{" "}
                  · {collection.recipeCount} recipes
                </span>
              </div>
              <div className={styles.recipeList}>
                {recipes.map((recipe) => (
                  <article className={`card ${styles.recipeCard}`} key={recipe.id}>
                    <Link className={styles.heroLink} href={`/recipes/${recipe.id}`}>
                      {recipe.heroPhotoUrl ? (
                        <Image
                          className={styles.heroImage}
                          src={recipe.heroPhotoUrl}
                          alt={recipe.title}
                          width={1200}
                          height={680}
                        />
                      ) : (
                        <HeroImagePlaceholder className={styles.heroPlaceholder} />
                      )}
                      <span className={styles.durationBadge}>
                        {recipe.timeRequiredMinutes ? `${recipe.timeRequiredMinutes} min` : "Time unknown"}
                      </span>
                    </Link>
                    <h3 className={styles.recipeTitle}>
                      <Link className={styles.recipeTitleLink} href={`/recipes/${recipe.id}`}>
                        {recipe.title}
                      </Link>
                    </h3>
                  </article>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </section>
  );
}
