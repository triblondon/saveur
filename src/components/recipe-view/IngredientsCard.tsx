import type { Ingredient } from "@/lib/types";
import styles from "@/components/styles/recipe-view.module.css";

interface IngredientRow {
  ingredient: Ingredient;
  checkKey: string;
  quantity: string;
}

interface IngredientsCardProps {
  mainIngredients: IngredientRow[];
  pantryIngredients: IngredientRow[];
  servings: number;
  servingsOptions: number[];
  onServingsChange: (next: number) => void;
  checkedIngredientKeys: Set<string>;
  onToggleIngredient: (checkKey: string, checked: boolean) => void;
  showShoppingNote: boolean;
  onClearShoppingChecks: () => void;
}

export function IngredientsCard(props: IngredientsCardProps) {
  const {
    mainIngredients,
    pantryIngredients,
    servings,
    servingsOptions,
    onServingsChange,
    checkedIngredientKeys,
    onToggleIngredient,
    showShoppingNote,
    onClearShoppingChecks
  } = props;

  return (
    <article className="card">
      <div className={styles.ingredientsHeader}>
        <h3 className={styles.ingredientsTitle}>Ingredients</h3>
        <label className={styles.ingredientsServingsControl}>
          <span className={`muted ${styles.ingredientsServingsLabel}`}>Servings</span>
          <select value={String(servings)} onChange={(event) => onServingsChange(Number(event.target.value))}>
            {servingsOptions.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </label>
      </div>
      {mainIngredients.length > 0 ? (
        <table className={styles.ingredientsTable}>
          <tbody>
            {mainIngredients.map(({ ingredient, checkKey, quantity }) => (
              <tr key={checkKey}>
                <td className={styles.ingredientNameCell}>
                  <label className={styles.ingredientToggleLabel}>
                    <input
                      type="checkbox"
                      className={styles.ingredientCheckbox}
                      checked={checkedIngredientKeys.has(checkKey)}
                      onChange={(event) => onToggleIngredient(checkKey, event.target.checked)}
                    />
                    <span>{ingredient.name}</span>
                  </label>
                </td>
                <td className={styles.ingredientQtyCell}>{quantity}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : null}
      {mainIngredients.length === 0 ? <p className="muted">All ingredients are pantry items.</p> : null}
      {pantryIngredients.length > 0 ? (
        <p className={`muted ${styles.pantryLine}`}>
          You also need: {pantryIngredients.map(({ ingredient }) => ingredient.name).join(", ")}
        </p>
      ) : null}
      {showShoppingNote ? (
        <p className={`muted ${styles.shoppingNotice}`}>
          Shopping checkmarks are cleared after a week. [
          <button type="button" className={styles.inlineLink} onClick={onClearShoppingChecks}>
            Clear now
          </button>
          ]
        </p>
      ) : null}
    </article>
  );
}
