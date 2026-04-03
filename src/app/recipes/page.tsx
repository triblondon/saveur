import Link from "next/link";
import Image from "next/image";
import { redirect } from "next/navigation";
import { HeroImagePlaceholder } from "@/components/HeroImagePlaceholder";
import { getCurrentUser } from "@/lib/auth/current-user";
import { listRecipeSummariesForUser } from "@/lib/store";
import styles from "@/app/styles/home.module.css";

interface RecipesPageProps {
  searchParams: Promise<{ q?: string }>;
}

export default async function RecipesPage({ searchParams }: RecipesPageProps) {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/auth?next=/recipes");
  }

  const params = await searchParams;
  const query = params.q?.trim() ?? "";
  const recipes = await listRecipeSummariesForUser(user.id, query || undefined);

  return (
    <section className={styles.page}>
      <form className={styles.searchCard} action="/recipes" method="GET">
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
              <Link className={styles.clearIcon} href="/recipes" aria-label="Clear search">
                ×
              </Link>
            ) : null}
          </div>
          <button className={styles.searchButton} type="submit">
            Search
          </button>
        </div>
      </form>

      {recipes.length === 0 ? (
        <p className={`muted ${styles.empty}`}>No recipes found yet.</p>
      ) : (
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
              <h2 className={styles.recipeTitle}>
                <Link className={styles.recipeTitleLink} href={`/recipes/${recipe.id}`}>
                  {recipe.title}
                </Link>
              </h2>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
