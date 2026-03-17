"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ReactTags, type Tag } from "react-tag-autocomplete";
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

type IngredientFormItem = Omit<
  IngredientInput,
  "quantityText" | "quantityValue" | "quantityMin" | "quantityMax" | "unit"
> & {
  id: string;
  quantity: string;
};

type PrepTaskFormItem = Omit<PrepTaskInput, "localId" | "detail"> & {
  id: string;
  detail: string;
};

type CookStepFormItem = Omit<CookStepInput, "timerSeconds" | "detail"> & {
  id: string;
  detail: string;
  timerSeconds: string;
};

interface TagOption {
  id: string;
  label: string;
}

const DEFAULT_TAG_SUGGESTIONS = [
  "Chicken",
  "Beef",
  "Pork",
  "Fish",
  "Vegetarian",
  "Vegan",
  "Easy",
  "Medium",
  "Hard",
  "Mild",
  "Medium spice",
  "Hot"
];

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

function normalizeTagLabel(value: string): string {
  return value
    .trim()
    .replace(/\s+/g, " ");
}

function RemoveXButton(props: { label: string; onClick: () => void; disabled?: boolean }) {
  const { label, onClick, disabled } = props;
  return (
    <button
      type="button"
      className="secondary"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      style={{
        position: "absolute",
        top: 10,
        right: 10,
        width: 30,
        height: 30,
        padding: 0,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center"
      }}
    >
      x
    </button>
  );
}

function TagsInput(props: { values: string[]; onChange: (next: string[]) => void }) {
  const { values, onChange } = props;

  const selected = useMemo<Tag[]>(
    () =>
      values.map((label) => ({
        label,
        value: label.toLowerCase()
      })),
    [values]
  );

  const suggestions = useMemo<Tag[]>(() => {
    const seen = new Set<string>();
    const labels: string[] = [];

    for (const label of [...values, ...DEFAULT_TAG_SUGGESTIONS]) {
      const normalized = normalizeTagLabel(label);
      const key = normalized.toLowerCase();
      if (!normalized || seen.has(key)) {
        continue;
      }

      seen.add(key);
      labels.push(normalized);
    }

    return labels.map((label) => ({
      label,
      value: label.toLowerCase()
    }));
  }, [values]);

  return (
    <ReactTags
      id="recipe-tags"
      labelText="Recipe tags"
      selected={selected}
      suggestions={suggestions}
      allowNew
      newOptionText="Add tag: %value%"
      placeholderText="Add tag"
      noOptionsText="No matching tags"
      onAdd={(nextTag) => {
        const label = normalizeTagLabel(nextTag.label);
        if (!label) {
          return;
        }

        const exists = values.some((item) => item.toLowerCase() === label.toLowerCase());
        if (exists) {
          return;
        }

        onChange([...values, label]);
      }}
      onDelete={(index) => onChange(values.filter((_, itemIndex) => itemIndex !== index))}
      onValidate={(value) => {
        const label = normalizeTagLabel(value);
        if (!label) {
          return false;
        }
        return !values.some((item) => item.toLowerCase() === label.toLowerCase());
      }}
    />
  );
}

function PrepTaskRefsInput(props: {
  selectedIds: string[];
  options: TagOption[];
  onChange: (next: string[]) => void;
  inputId: string;
}) {
  const { selectedIds, options, onChange, inputId } = props;

  const selected = useMemo<Tag[]>(() => {
    return selectedIds
      .map((id) => options.find((option) => option.id === id))
      .filter((option): option is TagOption => Boolean(option))
      .map((option) => ({
        label: option.label,
        value: option.id
      }));
  }, [options, selectedIds]);

  const suggestions = useMemo<Tag[]>(
    () =>
      options.map((option) => ({
        label: option.label,
        value: option.id
      })),
    [options]
  );

  return (
    <ReactTags
      id={inputId}
      labelText="Prep task references"
      selected={selected}
      suggestions={suggestions}
      placeholderText="Associate prep tasks"
      noOptionsText="No prep tasks"
      onAdd={(nextTag) => {
        const id = String(nextTag.value);
        if (!id || selectedIds.includes(id)) {
          return;
        }

        onChange([...selectedIds, id]);
      }}
      onDelete={(index) => onChange(selectedIds.filter((_, itemIndex) => itemIndex !== index))}
    />
  );
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
          id: ingredient.id,
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
          id: task.id,
          title: task.title,
          detail: task.detail ?? ""
        }))
      : []
  );
  const [cookSteps, setCookSteps] = useState<CookStepFormItem[]>(
    recipe && recipe.cookSteps.length > 0
      ? recipe.cookSteps.map((step) => ({
          id: step.id,
          instruction: step.instruction,
          detail: step.detail ?? "",
          timerSeconds: step.timerSeconds !== null ? String(step.timerSeconds) : "",
          prepTaskRefs: step.prepTaskRefs
        }))
      : [
          {
            id: makeLocalId("cook"),
            instruction: "",
            detail: "",
            timerSeconds: "",
            prepTaskRefs: []
          }
        ]
  );
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const prepTaskOptions: TagOption[] = prepTasks.map((task, index) => ({
    id: task.id,
    label: task.title.trim() || `Prep task ${index + 1}`
  }));

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
            unit: parsed?.unit ?? null,
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
        heroPhotoUrl: heroPhotoUrl.trim() || null,
        servingCount: parseOptionalNumber(servings),
        timeRequiredMinutes: parseOptionalNumber(minutes),
        ingredients: ingredientPayload,
        prepTasks: prepTasks
          .filter((item) => item.title.trim().length > 0)
          .map((item) => ({
            title: item.title.trim(),
            localId: item.id,
            detail: item.detail.trim() || null
          })),
        cookSteps: cookSteps
          .filter((item) => item.instruction.trim().length > 0)
          .map((item) => ({
            instruction: item.instruction.trim(),
            detail: item.detail.trim() || null,
            timerSeconds: parseOptionalNumber(item.timerSeconds),
            prepTaskRefs: item.prepTaskRefs
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
    <form onSubmit={onSubmit} className="card" style={{ display: "grid", gap: 14 }}>
      <label>
        Title
        <input required value={title} onChange={(event) => setTitle(event.target.value)} />
      </label>

      <label>
        Description
        <textarea rows={4} value={description} onChange={(event) => setDescription(event.target.value)} />
      </label>

      <div style={{ display: "grid", gap: 6 }}>
        <span>Tags</span>
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

      <section style={{ display: "grid", gap: 10 }}>
        <strong>Ingredients</strong>
        {ingredients.map((ingredient) => (
          <div key={ingredient.id} className="card" style={{ marginBottom: 0, position: "relative", paddingTop: 20 }}>
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
            <div className="row" style={{ alignItems: "center" }}>
              <label style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                <input
                  style={{ width: "auto" }}
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
              <label style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                <input
                  style={{ width: "auto" }}
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
              <label style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                <input
                  style={{ width: "auto" }}
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

      <section style={{ display: "grid", gap: 10 }}>
        <strong>Prep tasks</strong>
        {prepTasks.map((task) => (
          <div key={task.id} className="card" style={{ marginBottom: 0, position: "relative", paddingTop: 20 }}>
            <RemoveXButton
              label="Remove prep task"
              onClick={() => {
                setPrepTasks((previous) => previous.filter((item) => item.id !== task.id));
                setCookSteps((previous) =>
                  previous.map((step) => ({
                    ...step,
                    prepTaskRefs: step.prepTaskRefs.filter((ref) => ref !== task.id)
                  }))
                );
              }}
            />
            <label>
              Title
              <input
                value={task.title}
                onChange={(event) =>
                  setPrepTasks((previous) =>
                    previous.map((item) => (item.id === task.id ? { ...item, title: event.target.value } : item))
                  )
                }
              />
            </label>
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
          onClick={() => setPrepTasks((previous) => [...previous, { id: makeLocalId("prep"), title: "", detail: "" }])}
        >
          Add prep task
        </button>
      </section>

      <section style={{ display: "grid", gap: 10 }}>
        <strong>Cook steps</strong>
        {cookSteps.map((step) => (
          <div key={step.id} className="card" style={{ marginBottom: 0, position: "relative", paddingTop: 20 }}>
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
            <div style={{ display: "grid", gap: 6 }}>
              <span>Prep task refs</span>
              <PrepTaskRefsInput
                inputId={`prep-ref-${step.id}`}
                selectedIds={step.prepTaskRefs}
                options={prepTaskOptions}
                onChange={(next) =>
                  setCookSteps((previous) =>
                    previous.map((item) => (item.id === step.id ? { ...item, prepTaskRefs: next } : item))
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
                timerSeconds: "",
                prepTaskRefs: []
              }
            ])
          }
        >
          Add cook step
        </button>
      </section>

      <div className="row">
        <button type="submit" disabled={saving || deleting}>
          {saving ? (isEdit ? "Saving..." : "Creating...") : isEdit ? "Save changes" : "Create recipe"}
        </button>
        {isEdit ? (
          <button type="button" className="secondary" disabled={saving || deleting} onClick={() => void onDelete()}>
            {deleting ? "Deleting..." : "Delete recipe"}
          </button>
        ) : null}
      </div>
      {error ? <p style={{ margin: 0, color: "#a22525" }}>{error}</p> : null}
    </form>
  );
}
