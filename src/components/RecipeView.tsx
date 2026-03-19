"use client";

import { useMemo, useState } from "react";
import type { Recipe } from "@/lib/types";
import { scaleValue } from "@/lib/scaling";
import { RecipeHeaderCard } from "@/components/recipe-view/RecipeHeaderCard";
import { IngredientsCard } from "@/components/recipe-view/IngredientsCard";
import { PrepTasksCard } from "@/components/recipe-view/PrepTasksCard";
import { CookStepsSection } from "@/components/recipe-view/CookStepsSection";
import { RecipeActionsCard } from "@/components/recipe-view/RecipeActionsCard";
import styles from "@/components/styles/recipe-view.module.css";

const CREATED_DATE_FORMATTER = new Intl.DateTimeFormat("en-GB", {
  year: "numeric",
  month: "short",
  day: "numeric",
  timeZone: "UTC"
});

interface RecipeViewProps {
  recipe: Recipe;
}

export function RecipeView({ recipe }: RecipeViewProps) {
  const [servings, setServings] = useState<number>(recipe.servingCount ?? 2);

  const ingredientsWithQuantity = useMemo(
    () =>
      recipe.ingredients.map((ingredient) => ({
        ingredient,
        quantity: (() => {
          if (
            ingredient.quantityValue !== null &&
            recipe.servingCount &&
            recipe.servingCount > 0
          ) {
            const scaled = scaleValue(
              ingredient.quantityValue,
              recipe.servingCount,
              servings,
              ingredient.isWholeItem
            );
            const unit = ingredient.unit ? ingredient.unit.toLowerCase() : "";
            return unit ? `${scaled} ${unit}` : `${scaled}`;
          }

          if (ingredient.quantityText) {
            return ingredient.quantityText;
          }

          return "—";
        })()
      })),
    [recipe.ingredients, recipe.servingCount, servings]
  );

  const mainIngredients = useMemo(
    () => ingredientsWithQuantity.filter(({ ingredient }) => !ingredient.isPantryItem),
    [ingredientsWithQuantity]
  );

  const pantryIngredients = useMemo(
    () => ingredientsWithQuantity.filter(({ ingredient }) => ingredient.isPantryItem),
    [ingredientsWithQuantity]
  );

  const servingsOptions = useMemo(() => {
    const values = new Set<number>();
    for (let value = 1; value <= 10; value += 1) {
      values.add(value);
    }
    values.add(servings);
    if (recipe.servingCount && recipe.servingCount > 0) {
      values.add(recipe.servingCount);
    }

    return Array.from(values).sort((left, right) => left - right);
  }, [recipe.servingCount, servings]);

  const sourceLabel = useMemo(() => {
    if (recipe.sourceType !== "URL") {
      return recipe.sourceType;
    }

    const raw = recipe.sourceRef?.trim();
    if (!raw) {
      return "URL";
    }

    try {
      const url = new URL(raw);
      return url.hostname.replace(/^www\./i, "");
    } catch {
      try {
        const url = new URL(`https://${raw}`);
        return url.hostname.replace(/^www\./i, "");
      } catch {
        return raw;
      }
    }
  }, [recipe.sourceRef, recipe.sourceType]);

  const createdLabel = useMemo(() => {
    const parsed = new Date(recipe.createdAt);
    if (Number.isNaN(parsed.getTime())) {
      return recipe.createdAt;
    }

    return CREATED_DATE_FORMATTER.format(parsed);
  }, [recipe.createdAt]);

  return (
    <section className={styles.section}>
      <RecipeHeaderCard
        recipe={recipe}
        servings={servings}
        servingsOptions={servingsOptions}
        sourceLabel={sourceLabel}
        createdLabel={createdLabel}
        onServingsChange={setServings}
      />

      <IngredientsCard mainIngredients={mainIngredients} pantryIngredients={pantryIngredients} />

      <PrepTasksCard prepTasks={recipe.prepTasks} />

      <CookStepsSection cookSteps={recipe.cookSteps} />

      <RecipeActionsCard
        recipe={{
          id: recipe.id,
          sourceType: recipe.sourceType,
          importPrompt: recipe.importPrompt
        }}
      />
    </section>
  );
}
