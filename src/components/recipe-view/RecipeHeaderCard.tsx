import Image from "next/image";
import type { Recipe } from "@/lib/types";
import styles from "@/components/styles/recipe-view.module.css";

interface RecipeHeaderCardProps {
  recipe: Recipe;
  servings: number;
  servingsOptions: number[];
  sourceLabel: string;
  createdLabel: string;
  onServingsChange: (next: number) => void;
}

export function RecipeHeaderCard(props: RecipeHeaderCardProps) {
  const { recipe, servings, servingsOptions, sourceLabel, createdLabel, onServingsChange } = props;

  return (
    <article className={`card ${styles.headerCard}`}>
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
            <label>
              Servings
              <select value={String(servings)} onChange={(event) => onServingsChange(Number(event.target.value))}>
                {servingsOptions.map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </select>
            </label>
            <div>
              <p className={`muted ${styles.metricLabel}`}>Total time</p>
              <strong>{recipe.timeRequiredMinutes ? `${recipe.timeRequiredMinutes} minutes` : "Not set"}</strong>
            </div>
            <div>
              <p className={`muted ${styles.metricLabel}`}>Source</p>
              <strong className={styles.sourceValue}>{sourceLabel}</strong>
            </div>
            <div>
              <p className={`muted ${styles.metricLabel}`}>{recipe.sourceType === "URL" ? "Imported" : "Created"}</p>
              <strong>{createdLabel}</strong>
            </div>
          </div>
        </div>
      </div>
    </article>
  );
}

