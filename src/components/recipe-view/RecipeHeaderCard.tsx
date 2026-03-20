import Image from "next/image";
import type { Recipe } from "@/lib/types";
import styles from "@/components/styles/recipe-view.module.css";

interface RecipeHeaderCardProps {
  recipe: Recipe;
  sourceLabel: string;
  createdLabel: string;
}

export function RecipeHeaderCard(props: RecipeHeaderCardProps) {
  const { recipe, sourceLabel, createdLabel } = props;
  const sourceHref = recipe.sourceRef.trim();
  const sourceLink = recipe.sourceType === "URL" && sourceHref ? sourceHref : null;

  return (
    <article className={styles.headerCard}>
      <div className={styles.headerTop}>
        {recipe.heroPhotoUrl ? (
          <Image
            src={recipe.heroPhotoUrl}
            alt={recipe.title}
            className={styles.heroImage}
            width={1200}
            height={700}
          />
        ) : null}
        <div className={styles.headerMetaPanel}>
          <div className={styles.headerMeta}>
          <h2 className={styles.title}>{recipe.title}</h2>
          {recipe.description ? <p className={styles.description}>{recipe.description}</p> : null}
          {recipe.tags.length > 0 ? (
            <ul className={`inline-list ${styles.tagList}`}>
              {recipe.tags.map((tag) => (
                <li className="tag" key={tag}>
                  {tag}
                </li>
              ))}
            </ul>
          ) : null}
          <div className={`row ${styles.metaRow}`}>
            <div>
              <p className={`muted ${styles.metricLabel}`}>Total time</p>
              <strong>{recipe.timeRequiredMinutes ? `${recipe.timeRequiredMinutes} minutes` : "Not set"}</strong>
            </div>
            <div>
              <p className={`muted ${styles.metricLabel}`}>Source</p>
              <strong className={styles.sourceValue}>
                {sourceLink ? (
                  <a
                    href={sourceLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={styles.sourceLink}
                  >
                    {sourceLabel}
                  </a>
                ) : (
                  sourceLabel
                )}
              </strong>
            </div>
            <div>
              <p className={`muted ${styles.metricLabel}`}>{recipe.sourceType === "URL" ? "Imported" : "Created"}</p>
              <strong>{createdLabel}</strong>
            </div>
          </div>
          </div>
        </div>
      </div>
    </article>
  );
}
