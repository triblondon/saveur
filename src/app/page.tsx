import Link from "next/link";
import { listRecipes } from "@/lib/store";

interface HomeProps {
  searchParams: Promise<{ q?: string }>;
}

export default async function Home({ searchParams }: HomeProps) {
  const params = await searchParams;
  const query = params.q?.trim() ?? "";
  const recipes = await listRecipes(query || undefined);

  return (
    <section>
      <form className="card" action="/" method="GET" style={{ display: "grid", gap: 10 }}>
        <label htmlFor="q">Search recipes by title, ingredient, or tag</label>
        <input
          id="q"
          name="q"
          placeholder="e.g. kedgeree, haddock, spicy"
          defaultValue={query}
        />
        <div className="row">
          <button type="submit">Search</button>
          <Link href="/" style={{ alignSelf: "center" }}>
            Clear
          </Link>
        </div>
      </form>

      {recipes.length === 0 ? (
        <p className="muted">No recipes found yet.</p>
      ) : (
        recipes.map((recipe) => (
          <article className="card" key={recipe.id}>
            {recipe.heroPhotoUrl ? (
              <Link href={`/recipes/${recipe.id}`}>
                <img
                  src={recipe.heroPhotoUrl}
                  alt={recipe.title}
                  style={{
                    width: "100%",
                    maxHeight: 220,
                    objectFit: "cover",
                    borderRadius: 12,
                    marginBottom: 12
                  }}
                />
              </Link>
            ) : null}
            <h2 style={{ marginTop: 0, marginBottom: 8 }}>
              <Link href={`/recipes/${recipe.id}`}>{recipe.title}</Link>
            </h2>
            <p className="muted" style={{ marginTop: 0 }}>
              {recipe.timeRequiredMinutes ? `${recipe.timeRequiredMinutes} min` : "Time unknown"}
              {" | "}
              {recipe.servingCount ? `${recipe.servingCount} servings` : "Servings unknown"}
              {" | "}
              {recipe.sourceType}
            </p>
            {recipe.tags.length > 0 ? (
              <ul className="inline-list">
                {recipe.tags.map((tag) => (
                  <li className="tag" key={tag}>
                    {tag}
                  </li>
                ))}
              </ul>
            ) : null}
          </article>
        ))
      )}
    </section>
  );
}
