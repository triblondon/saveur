import Link from "next/link";
import Image from "next/image";
import { listRecipeSummaries } from "@/lib/store";
import styles from "@/app/styles/home.module.css";

interface HomeProps {
  searchParams: Promise<{ q?: string }>;
}

export default async function Home({ searchParams }: HomeProps) {
  const params = await searchParams;
  const query = params.q?.trim() ?? "";
  const recipes = await listRecipeSummaries(query || undefined);

  return (
    <section className={styles.page}>
      <form className={`card ${styles.searchCard}`} action="/" method="GET">
        <label htmlFor="q">Search recipes by title, ingredient, or tag</label>
        <div className={styles.searchRow}>
          <div className={styles.searchInputWrap}>
            <input
              className={styles.searchInput}
              id="q"
              name="q"
              placeholder="e.g. kedgeree, haddock, spicy"
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

      {recipes.length === 0 ? (
        <p className={`muted ${styles.empty}`}>No recipes found yet.</p>
      ) : (
        <div className={styles.recipeList}>
          {recipes.map((recipe) => (
            <article className={`card ${styles.recipeCard}`} key={recipe.id}>
              {recipe.heroPhotoUrl ? (
                <Link className={styles.heroLink} href={`/recipes/${recipe.id}`}>
                  <Image
                    className={styles.heroImage}
                    src={recipe.heroPhotoUrl}
                    alt={recipe.title}
                    width={1200}
                    height={680}
                  />
                </Link>
              ) : null}
              <h2 className={styles.recipeTitle}>
                <Link className={styles.recipeTitleLink} href={`/recipes/${recipe.id}`}>
                  {recipe.title}
                </Link>
              </h2>
              <p className={`muted ${styles.meta}`}>
                {recipe.timeRequiredMinutes ? `${recipe.timeRequiredMinutes} min` : "Time unknown"}
                {" | "}
                {recipe.servingCount ? `${recipe.servingCount} servings` : "Servings unknown"}
                {" | "}
                {recipe.sourceType}
              </p>
              {recipe.tags.length > 0 ? (
                <ul className={`inline-list ${styles.tagList}`}>
                  {recipe.tags.map((tag) => (
                    <li className="tag" key={tag}>
                      {tag}
                    </li>
                  ))}
                </ul>
              ) : null}
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
