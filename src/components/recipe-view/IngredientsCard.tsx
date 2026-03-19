import type { Ingredient } from "@/lib/types";
import styles from "@/components/styles/recipe-view.module.css";

interface IngredientRow {
  ingredient: Ingredient;
  quantity: string;
}

interface IngredientsCardProps {
  mainIngredients: IngredientRow[];
  pantryIngredients: IngredientRow[];
}

export function IngredientsCard({ mainIngredients, pantryIngredients }: IngredientsCardProps) {
  return (
    <article className="card">
      <h3 className={styles.ingredientsTitle}>Ingredients</h3>
      {mainIngredients.length > 0 ? (
        <table className={styles.ingredientsTable}>
          <tbody>
            {mainIngredients.map(({ ingredient, quantity }) => (
              <tr key={`${ingredient.name}-${quantity}`}>
                <td className={styles.ingredientNameCell}>{ingredient.name}</td>
                <td className={styles.ingredientQtyCell}>{quantity}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : null}
      {mainIngredients.length === 0 ? <p className="muted">All ingredients are pantry items.</p> : null}
      {pantryIngredients.length > 0 ? (
        <p className={`muted ${styles.pantryLine}`}>
          Also: {pantryIngredients.map(({ ingredient }) => ingredient.name).join(", ")}
        </p>
      ) : null}
    </article>
  );
}

