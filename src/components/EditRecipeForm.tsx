"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { parseIngredientLine } from "@/lib/parse/quantity";
import {
  SOURCE_TYPE_OPTIONS,
  type CookStepInput,
  type Ingredient,
  type IngredientInput,
  type PrepTaskInput,
  type Recipe,
  type SourceType
} from "@/lib/types";
import { NameListInput, RemoveXButton, TagsInput } from "@/components/edit-recipe-form/inputs";
import styles from "@/components/styles/edit-recipe-form.module.css";

type IngredientFormItem = Omit<
  IngredientInput,
  "quantityText" | "quantityValue" | "quantityMin" | "quantityMax" | "unit"
> & {
  id: string;
  quantity: string;
};

type PrepTaskFormItem = Omit<PrepTaskInput, "detail"> & {
  id: string;
  detail: string;
};

type CookStepFormItem = Omit<CookStepInput, "timerSeconds" | "detail"> & {
  id: string;
  detail: string;
  sourceIngredients: string[];
  timerSeconds: string;
};

function makeLocalId(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

function parseOptionalNumber(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
}

function serializeIngredientQuantity(ingredient: Ingredient): string {
  if (ingredient.quantityText) {
    return ingredient.quantityText;
  }

  if (ingredient.quantityValue !== null) {
    const unit = ingredient.unit ? ingredient.unit.toLowerCase() : "";
    return unit ? `${ingredient.quantityValue} ${unit}` : `${ingredient.quantityValue}`;
  }

  return "";
}

interface EditRecipeFormProps {
  recipe?: Recipe;
}

export function EditRecipeForm({ recipe }: EditRecipeFormProps) {
  const router = useRouter();
  const isEdit = Boolean(recipe);

  const [title, setTitle] = useState(recipe?.title ?? "");
  const [description, setDescription] = useState(recipe?.description ?? "");
  const [tags, setTags] = useState<string[]>(recipe?.tags ?? []);
  const [sourceType, setSourceType] = useState<SourceType>(recipe?.sourceType ?? "MANUAL");
  const [sourceRef, setSourceRef] = useState(recipe?.sourceRef ?? "");
  const [heroPhotoUrl, setHeroPhotoUrl] = useState(recipe?.heroPhotoUrl ?? "");
  const [servings, setServings] = useState(recipe?.servingCount ? String(recipe.servingCount) : "");
  const [minutes, setMinutes] = useState(
    recipe?.timeRequiredMinutes ? String(recipe.timeRequiredMinutes) : ""
  );
  const [ingredients, setIngredients] = useState<IngredientFormItem[]>(
    recipe && recipe.ingredients.length > 0
      ? recipe.ingredients.map((ingredient) => ({
          id: makeLocalId("ingredient"),
          name: ingredient.name,
          quantity: serializeIngredientQuantity(ingredient),
          isWholeItem: ingredient.isWholeItem,
          optional: ingredient.optional,
          isPantryItem: ingredient.isPantryItem
        }))
      : [
          {
            id: makeLocalId("ingredient"),
            name: "",
            quantity: "",
            isWholeItem: false,
            optional: false,
            isPantryItem: false
          }
        ]
  );
  const [prepTasks, setPrepTasks] = useState<PrepTaskFormItem[]>(
    recipe
      ? recipe.prepTasks.map((task) => ({
          id: makeLocalId("prep"),
          preparationName: task.preparationName,
          sourceIngredients: task.sourceIngredients,
          detail: task.detail ?? ""
        }))
      : []
  );
  const [cookSteps, setCookSteps] = useState<CookStepFormItem[]>(
    recipe && recipe.cookSteps.length > 0
      ? recipe.cookSteps.map((step) => ({
          id: makeLocalId("cook"),
          instruction: step.instruction,
          detail: step.detail ?? "",
          sourceIngredients: step.sourceIngredients ?? [],
          timerSeconds: step.timerSeconds !== null ? String(step.timerSeconds) : ""
        }))
      : [
          {
            id: makeLocalId("cook"),
            instruction: "",
            detail: "",
            sourceIngredients: [],
            timerSeconds: ""
          }
        ]
  );
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const ingredientNameSuggestions = useMemo(
    () => ingredients.map((item) => item.name.trim()).filter(Boolean),
    [ingredients]
  );
  const prepOutputSuggestions = useMemo(
    () => prepTasks.map((item) => item.preparationName.trim()).filter(Boolean),
    [prepTasks]
  );
  const cookSourceSuggestions = useMemo(
    () => [...ingredientNameSuggestions, ...prepOutputSuggestions],
    [ingredientNameSuggestions, prepOutputSuggestions]
  );

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError(null);

    try {
      const ingredientPayload = ingredients
        .filter((item) => item.name.trim().length > 0)
        .map((item) => {
          const trimmedName = item.name.trim();
          const trimmedQuantity = item.quantity.trim();
          const parsed = trimmedQuantity ? parseIngredientLine(`${trimmedQuantity} ${trimmedName}`) : null;

          return {
            name: trimmedName,
            quantityText: trimmedQuantity || null,
            quantityValue: parsed?.quantityValue ?? null,
            quantityMin: parsed?.quantityMin ?? null,
            quantityMax: parsed?.quantityMax ?? null,
            unit: parsed?.unit ?? "UNKNOWN",
            isWholeItem: item.isWholeItem,
            optional: item.optional,
            isPantryItem: item.isPantryItem
          };
        });

      const payload = {
        title: title.trim(),
        description: description.trim() || null,
        tags: tags.map((tag) => tag.trim()).filter(Boolean),
        sourceType,
        sourceRef: sourceRef.trim(),
        importPrompt: recipe?.importPrompt ?? null,
        importRunId: recipe?.importRunId ?? null,
        heroPhotoUrl: heroPhotoUrl.trim() || null,
        servingCount: parseOptionalNumber(servings),
        timeRequiredMinutes: parseOptionalNumber(minutes),
        ingredients: ingredientPayload,
        prepTasks: prepTasks
          .filter((item) => item.preparationName.trim().length > 0)
          .map((item) => ({
            preparationName: item.preparationName.trim(),
            sourceIngredients: item.sourceIngredients.map((name) => name.trim()).filter(Boolean),
            detail: item.detail.trim() || null
          })),
        cookSteps: cookSteps
          .filter((item) => item.instruction.trim().length > 0)
          .map((item) => ({
            instruction: item.instruction.trim(),
            detail: item.detail.trim() || null,
            sourceIngredients: item.sourceIngredients.map((name) => name.trim()).filter(Boolean),
            timerSeconds: parseOptionalNumber(item.timerSeconds)
          }))
      };

      if (!payload.title) {
        throw new Error("Title is required");
      }
      if (payload.ingredients.length === 0) {
        throw new Error("At least one ingredient is required");
      }
      if (payload.cookSteps.length === 0) {
        throw new Error("At least one cook step is required");
      }

      const response = await fetch(isEdit ? `/api/recipes/${recipe!.id}` : "/api/recipes", {
        method: isEdit ? "PUT" : "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify(payload)
      });

      const body = (await response.json()) as { recipe?: { id: string }; error?: string };
      if (!response.ok || !body.recipe) {
        throw new Error(body.error ?? (isEdit ? "Unable to update recipe" : "Unable to create recipe"));
      }

      router.push(`/recipes/${body.recipe.id}`);
      router.refresh();
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : isEdit
            ? "Unable to update recipe"
            : "Unable to create recipe"
      );
    } finally {
      setSaving(false);
    }
  }

  async function onDelete() {
    if (!isEdit || !recipe) {
      return;
    }

    if (!window.confirm("Delete this recipe? This cannot be undone.")) {
      return;
    }

    setDeleting(true);
    setError(null);

    try {
      const response = await fetch(`/api/recipes/${recipe.id}`, {
        method: "DELETE"
      });
      const body = (await response.json()) as { deleted?: boolean; error?: string };

      if (!response.ok || !body.deleted) {
        throw new Error(body.error ?? "Unable to delete recipe");
      }

      router.push("/");
      router.refresh();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Unable to delete recipe");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className={`card ${styles.form}`}>
      <label>
        Title
        <input required value={title} onChange={(event) => setTitle(event.target.value)} />
      </label>

      <label>
        Description
        <textarea rows={4} value={description} onChange={(event) => setDescription(event.target.value)} />
      </label>

      <div className={styles.metaBlock}>
        <span className={styles.metaLabel}>Tags</span>
        <TagsInput values={tags} onChange={setTags} />
      </div>

      <div className="row">
        <label>
          Source type
          <select value={sourceType} onChange={(event) => setSourceType(event.target.value as SourceType)}>
            {SOURCE_TYPE_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>
        <label>
          Source ref
          <input value={sourceRef} onChange={(event) => setSourceRef(event.target.value)} />
        </label>
      </div>

      <div className="row">
        <label>
          Hero image URL
          <input value={heroPhotoUrl} onChange={(event) => setHeroPhotoUrl(event.target.value)} />
        </label>
        <label>
          Servings
          <input type="number" min="1" value={servings} onChange={(event) => setServings(event.target.value)} />
        </label>
        <label>
          Total minutes
          <input type="number" min="1" value={minutes} onChange={(event) => setMinutes(event.target.value)} />
        </label>
      </div>

      <section className={styles.section}>
        <h3 className={styles.sectionTitle}>Ingredients</h3>
        {ingredients.map((ingredient) => (
          <div key={ingredient.id} className={`card ${styles.itemCard}`}>
            <RemoveXButton
              label="Remove ingredient"
              onClick={() => setIngredients((previous) => previous.filter((item) => item.id !== ingredient.id))}
              disabled={ingredients.length === 1}
            />
            <label>
              Name
              <input
                value={ingredient.name}
                onChange={(event) =>
                  setIngredients((previous) =>
                    previous.map((item) => (item.id === ingredient.id ? { ...item, name: event.target.value } : item))
                  )
                }
              />
            </label>
            <label>
              Quantity
              <input
                value={ingredient.quantity}
                placeholder="e.g. 2, 1/2 tbsp, 300 ml"
                onChange={(event) =>
                  setIngredients((previous) =>
                    previous.map((item) =>
                      item.id === ingredient.id ? { ...item, quantity: event.target.value } : item
                    )
                  )
                }
              />
            </label>
            <div className={`row ${styles.checkboxRow}`}>
              <label className={styles.checkboxLabel}>
                <input
                  type="checkbox"
                  checked={ingredient.isWholeItem}
                  onChange={(event) =>
                    setIngredients((previous) =>
                      previous.map((item) =>
                        item.id === ingredient.id ? { ...item, isWholeItem: event.target.checked } : item
                      )
                    )
                  }
                />
                Whole item
              </label>
              <label className={styles.checkboxLabel}>
                <input
                  type="checkbox"
                  checked={ingredient.optional}
                  onChange={(event) =>
                    setIngredients((previous) =>
                      previous.map((item) =>
                        item.id === ingredient.id ? { ...item, optional: event.target.checked } : item
                      )
                    )
                  }
                />
                Optional
              </label>
              <label className={styles.checkboxLabel}>
                <input
                  type="checkbox"
                  checked={ingredient.isPantryItem}
                  onChange={(event) =>
                    setIngredients((previous) =>
                      previous.map((item) =>
                        item.id === ingredient.id ? { ...item, isPantryItem: event.target.checked } : item
                      )
                    )
                  }
                />
                Pantry item
              </label>
            </div>
          </div>
        ))}
        <button
          type="button"
          className="secondary"
          onClick={() =>
            setIngredients((previous) => [
              ...previous,
              {
                id: makeLocalId("ingredient"),
                name: "",
                quantity: "",
                isWholeItem: false,
                optional: false,
                isPantryItem: false
              }
            ])
          }
        >
          Add ingredient
        </button>
      </section>

      <section className={styles.section}>
        <h3 className={styles.sectionTitle}>Prep tasks</h3>
        {prepTasks.map((task) => (
          <div key={task.id} className={`card ${styles.itemCard}`}>
            <RemoveXButton
              label="Remove prep task"
              onClick={() => setPrepTasks((previous) => previous.filter((item) => item.id !== task.id))}
            />
            <label>
              Preparation name
              <input
                value={task.preparationName}
                onChange={(event) =>
                  setPrepTasks((previous) =>
                    previous.map((item) =>
                      item.id === task.id ? { ...item, preparationName: event.target.value } : item
                    )
                  )
                }
              />
            </label>
            <div className={styles.inlineField}>
              <span className={styles.metaLabel}>Source ingredients</span>
              <NameListInput
                id={`prep-source-${task.id}`}
                labelText="Prep source ingredients"
                values={task.sourceIngredients}
                suggestions={ingredientNameSuggestions}
                placeholderText="Add ingredient names"
                onChange={(next) =>
                  setPrepTasks((previous) =>
                    previous.map((item) => (item.id === task.id ? { ...item, sourceIngredients: next } : item))
                  )
                }
              />
            </div>
            <label>
              Detail
              <textarea
                rows={2}
                value={task.detail}
                onChange={(event) =>
                  setPrepTasks((previous) =>
                    previous.map((item) => (item.id === task.id ? { ...item, detail: event.target.value } : item))
                  )
                }
              />
            </label>
          </div>
        ))}
        <button
          type="button"
          className="secondary"
          onClick={() =>
            setPrepTasks((previous) => [
              ...previous,
              { id: makeLocalId("prep"), preparationName: "", sourceIngredients: [], detail: "" }
            ])
          }
        >
          Add prep task
        </button>
      </section>

      <section className={styles.section}>
        <h3 className={styles.sectionTitle}>Cook steps</h3>
        {cookSteps.map((step) => (
          <div key={step.id} className={`card ${styles.itemCard}`}>
            <RemoveXButton
              label="Remove cook step"
              onClick={() => setCookSteps((previous) => previous.filter((item) => item.id !== step.id))}
              disabled={cookSteps.length === 1}
            />
            <div className="row">
              <label>
                Instruction
                <input
                  value={step.instruction}
                  onChange={(event) =>
                    setCookSteps((previous) =>
                      previous.map((item) =>
                        item.id === step.id ? { ...item, instruction: event.target.value } : item
                      )
                    )
                  }
                />
              </label>
              <label>
                Timer seconds
                <input
                  type="number"
                  min="0"
                  value={step.timerSeconds}
                  onChange={(event) =>
                    setCookSteps((previous) =>
                      previous.map((item) =>
                        item.id === step.id ? { ...item, timerSeconds: event.target.value } : item
                      )
                    )
                  }
                />
              </label>
            </div>
            <label>
              Detail
              <textarea
                rows={2}
                value={step.detail}
                onChange={(event) =>
                  setCookSteps((previous) =>
                    previous.map((item) => (item.id === step.id ? { ...item, detail: event.target.value } : item))
                  )
                }
              />
            </label>
            <div className={styles.inlineField}>
              <span className={styles.metaLabel}>Source ingredients</span>
              <NameListInput
                id={`cook-source-${step.id}`}
                labelText="Cook step source ingredients"
                values={step.sourceIngredients}
                suggestions={cookSourceSuggestions}
                placeholderText="Add raw/prepared ingredient names"
                onChange={(next) =>
                  setCookSteps((previous) =>
                    previous.map((item) => (item.id === step.id ? { ...item, sourceIngredients: next } : item))
                  )
                }
              />
            </div>
          </div>
        ))}
        <button
          type="button"
          className="secondary"
          onClick={() =>
            setCookSteps((previous) => [
              ...previous,
              {
                id: makeLocalId("cook"),
                instruction: "",
                detail: "",
                sourceIngredients: [],
                timerSeconds: ""
              }
            ])
          }
        >
          Add cook step
        </button>
      </section>

      <div className={`row ${styles.actions}`}>
        <button type="submit" disabled={saving || deleting}>
          {saving ? (isEdit ? "Saving..." : "Creating...") : isEdit ? "Save changes" : "Create recipe"}
        </button>
        {isEdit ? (
          <button type="button" className="secondary" disabled={saving || deleting} onClick={() => void onDelete()}>
            {deleting ? "Deleting..." : "Delete recipe"}
          </button>
        ) : null}
      </div>
      {error ? <p className={styles.error}>{error}</p> : null}
    </form>
  );
}
