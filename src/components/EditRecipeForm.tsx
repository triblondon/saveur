"use client";

import Sortable, { type SortableEvent } from "sortablejs";
import { type FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { parseIngredientLine } from "@/lib/parse/quantity";
import {
  SOURCE_TYPE_OPTIONS,
  type CookStepInput,
  type Ingredient,
  type IngredientInput,
  type PrepTaskInput,
  type CollectionSummary,
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

interface ValidationIssue {
  instancePath?: string;
  message?: string;
  keyword?: string;
  params?: {
    missingProperty?: string;
  };
}

type FieldErrorMap = Record<string, string[]>;

interface PayloadIndexMaps {
  ingredientIds: string[];
  prepTaskIds: string[];
  cookStepIds: string[];
}

function makeLocalId(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

function makeInitialId(prefix: string, index: number): string {
  return `${prefix}-${index}`;
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

function addFieldError(errors: FieldErrorMap, key: string, message: string): void {
  const normalizedMessage = message.trim() || "Invalid value";
  errors[key] = errors[key] ?? [];
  if (!errors[key].includes(normalizedMessage)) {
    errors[key].push(normalizedMessage);
  }
}

function mapIssueToFieldKey(issue: ValidationIssue, maps: PayloadIndexMaps): string {
  const tokens = (issue.instancePath ?? "").split("/").filter(Boolean);
  if (issue.keyword === "required" && issue.params?.missingProperty) {
    tokens.push(issue.params.missingProperty);
  }

  if (tokens.length === 0) {
    return "form";
  }

  const root = tokens[0];

  if (root === "ingredients") {
    if (tokens.length < 2) {
      return "ingredients";
    }

    const itemIndex = Number(tokens[1]);
    const itemId = maps.ingredientIds[itemIndex];
    if (!itemId) {
      return "ingredients";
    }

    const field = tokens[2] ?? "row";
    if (["quantityText", "quantityValue", "quantityMin", "quantityMax", "unit"].includes(field)) {
      return `ingredient:${itemId}:quantity`;
    }

    if (["name", "isWholeItem", "optional", "isPantryItem"].includes(field)) {
      return `ingredient:${itemId}:${field}`;
    }

    return `ingredient:${itemId}:row`;
  }

  if (root === "prepTasks") {
    if (tokens.length < 2) {
      return "prepTasks";
    }

    const itemIndex = Number(tokens[1]);
    const itemId = maps.prepTaskIds[itemIndex];
    if (!itemId) {
      return "prepTasks";
    }

    const field = tokens[2] ?? "row";
    if (["preparationName", "detail", "sourceIngredients"].includes(field)) {
      return `prep:${itemId}:${field}`;
    }

    return `prep:${itemId}:row`;
  }

  if (root === "cookSteps") {
    if (tokens.length < 2) {
      return "cookSteps";
    }

    const itemIndex = Number(tokens[1]);
    const itemId = maps.cookStepIds[itemIndex];
    if (!itemId) {
      return "cookSteps";
    }

    const field = tokens[2] ?? "row";
    if (["instruction", "detail", "sourceIngredients", "timerSeconds"].includes(field)) {
      return `cook:${itemId}:${field}`;
    }

    return `cook:${itemId}:row`;
  }

  if (
    [
      "title",
      "description",
      "tags",
      "collectionId",
      "sourceType",
      "sourceRef",
      "heroPhotoUrl",
      "servingCount",
      "timeRequiredMinutes"
    ].includes(root)
  ) {
    return root;
  }

  return "form";
}

function buildFieldErrors(issues: ValidationIssue[], maps: PayloadIndexMaps): FieldErrorMap {
  const errors: FieldErrorMap = {};

  for (const issue of issues) {
    const key = mapIssueToFieldKey(issue, maps);
    addFieldError(errors, key, issue.message ?? "Invalid value");
  }

  return errors;
}

function reorderByIndex<T>(items: T[], sourceIndex: number, targetIndex: number): T[] {
  if (sourceIndex < 0 || targetIndex < 0 || sourceIndex === targetIndex) {
    return items;
  }

  const next = [...items];
  const [moved] = next.splice(sourceIndex, 1);
  next.splice(targetIndex, 0, moved);
  return next;
}

interface EditRecipeFormProps {
  recipe?: Recipe;
  writableCollections?: CollectionSummary[];
  initialCollectionId?: string;
}

export function EditRecipeForm({
  recipe,
  writableCollections = [],
  initialCollectionId = "",
}: EditRecipeFormProps) {
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
  const [collectionId, setCollectionId] = useState(() => {
    if (recipe?.collectionId && writableCollections.some((entry) => entry.id === recipe.collectionId)) {
      return recipe.collectionId;
    }
    if (initialCollectionId && writableCollections.some((entry) => entry.id === initialCollectionId)) {
      return initialCollectionId;
    }
    return writableCollections[0]?.id ?? "";
  });
  const [ingredients, setIngredients] = useState<IngredientFormItem[]>(
    recipe && recipe.ingredients.length > 0
      ? recipe.ingredients.map((ingredient, index) => ({
          id: makeInitialId("ingredient", index),
          name: ingredient.name,
          quantity: serializeIngredientQuantity(ingredient),
          isWholeItem: ingredient.isWholeItem,
          optional: ingredient.optional,
          isPantryItem: ingredient.isPantryItem
        }))
      : [
          {
            id: makeInitialId("ingredient", 0),
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
      ? recipe.prepTasks.map((task, index) => ({
          id: makeInitialId("prep", index),
          preparationName: task.preparationName,
          sourceIngredients: task.sourceIngredients,
          detail: task.detail ?? ""
        }))
      : []
  );
  const [cookSteps, setCookSteps] = useState<CookStepFormItem[]>(
    recipe && recipe.cookSteps.length > 0
      ? recipe.cookSteps.map((step, index) => ({
          id: makeInitialId("cook", index),
          instruction: step.instruction,
          detail: step.detail ?? "",
          sourceIngredients: step.sourceIngredients ?? [],
          timerSeconds: step.timerSeconds !== null ? String(step.timerSeconds) : ""
        }))
      : [
          {
            id: makeInitialId("cook", 0),
            instruction: "",
            detail: "",
            sourceIngredients: [],
            timerSeconds: ""
          }
        ]
  );
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [heroUploading, setHeroUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [heroUploadError, setHeroUploadError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FieldErrorMap>({});
  const cookStepsListRef = useRef<HTMLDivElement | null>(null);
  const cookSortableRef = useRef<Sortable | null>(null);

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

  function fieldError(key: string): string | null {
    return fieldErrors[key]?.[0] ?? null;
  }

  function inputClass(key: string): string | undefined {
    return fieldError(key) ? styles.inputError : undefined;
  }

  function fieldErrorText(key: string) {
    const message = fieldError(key);
    return message ? <p className={styles.fieldError}>{message}</p> : null;
  }

  async function onUploadHeroPhoto(file: File | null) {
    if (!file) {
      return;
    }

    setHeroUploadError(null);
    setHeroUploading(true);

    try {
      const formData = new FormData();
      formData.append("file", file, file.name);

      const response = await fetch("/api/uploads/image", {
        method: "POST",
        body: formData
      });

      const body = (await response.json()) as { url?: string; error?: string };
      if (!response.ok || !body.url) {
        throw new Error(body.error ?? "Unable to upload image");
      }

      setHeroPhotoUrl(body.url);
      setFieldErrors((previous) => {
        if (!previous.heroPhotoUrl) {
          return previous;
        }
        const next = { ...previous };
        delete next.heroPhotoUrl;
        return next;
      });
    } catch (uploadError) {
      setHeroUploadError(uploadError instanceof Error ? uploadError.message : "Unable to upload image");
    } finally {
      setHeroUploading(false);
    }
  }

  useEffect(() => {
    const listElement = cookStepsListRef.current;
    if (!listElement) {
      return;
    }

    const sortable = Sortable.create(listElement, {
      animation: 170,
      handle: `.${styles.dragHandle}`,
      draggable: `.${styles.sortableItem}`,
      ghostClass: styles.sortableGhost,
      chosenClass: styles.sortableChosen,
      dragClass: styles.sortableDragging,
      onEnd: ({ oldIndex, newIndex }: SortableEvent) => {
        if (oldIndex === undefined || newIndex === undefined || oldIndex === newIndex) {
          return;
        }

        setCookSteps((previous) => reorderByIndex(previous, oldIndex, newIndex));
      }
    });

    cookSortableRef.current = sortable;

    return () => {
      sortable.destroy();
      cookSortableRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!cookSortableRef.current) {
      return;
    }

    cookSortableRef.current.option("disabled", cookSteps.length < 2 || saving || deleting);
  }, [cookSteps.length, saving, deleting]);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    setFieldErrors({});

    try {
      const ingredientPayload: IngredientInput[] = [];
      const ingredientIds: string[] = [];
      for (const item of ingredients) {
        const trimmedName = item.name.trim();
        if (!trimmedName) {
          continue;
        }

        const trimmedQuantity = item.quantity.trim();
        const parsed = trimmedQuantity ? parseIngredientLine(`${trimmedQuantity} ${trimmedName}`) : null;

        ingredientIds.push(item.id);
        ingredientPayload.push({
          name: trimmedName,
          quantityText: trimmedQuantity || null,
          quantityValue: parsed?.quantityValue ?? null,
          quantityMin: parsed?.quantityMin ?? null,
          quantityMax: parsed?.quantityMax ?? null,
          unit: parsed?.unit ?? "UNKNOWN",
          isWholeItem: item.isWholeItem,
          optional: item.optional,
          isPantryItem: item.isPantryItem
        });
      }

      const prepPayload: PrepTaskInput[] = [];
      const prepTaskIds: string[] = [];
      for (const item of prepTasks) {
        const preparationName = item.preparationName.trim();
        if (!preparationName) {
          continue;
        }

        prepTaskIds.push(item.id);
        prepPayload.push({
          preparationName,
          sourceIngredients: item.sourceIngredients.map((name) => name.trim()).filter(Boolean),
          detail: item.detail.trim() || null
        });
      }

      const cookPayload: CookStepInput[] = [];
      const cookStepIds: string[] = [];
      for (const item of cookSteps) {
        const instruction = item.instruction.trim();
        if (!instruction) {
          continue;
        }

        cookStepIds.push(item.id);
        cookPayload.push({
          instruction,
          detail: item.detail.trim() || null,
          sourceIngredients: item.sourceIngredients.map((name) => name.trim()).filter(Boolean),
          timerSeconds: parseOptionalNumber(item.timerSeconds)
        });
      }

      const payload = {
        collectionId: collectionId.trim(),
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
        prepTasks: prepPayload,
        cookSteps: cookPayload
      };

      if (!payload.title) {
        setFieldErrors({ title: ["Title is required"] });
        throw new Error("Title is required");
      }

      if (!payload.collectionId) {
        setFieldErrors({ collectionId: ["Collection is required"] });
        throw new Error("Collection is required");
      }

      if (payload.ingredients.length === 0) {
        setFieldErrors({ ingredients: ["At least one ingredient is required"] });
        throw new Error("At least one ingredient is required");
      }

      if (payload.cookSteps.length === 0) {
        setFieldErrors({ cookSteps: ["At least one cook step is required"] });
        throw new Error("At least one cook step is required");
      }

      const response = await fetch(isEdit ? `/api/recipes/${recipe!.id}` : "/api/recipes", {
        method: isEdit ? "PUT" : "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify(payload)
      });

      const body = (await response.json()) as {
        recipe?: { id: string };
        error?: string;
        detail?: string;
        issues?: ValidationIssue[];
      };

      if (!response.ok || !body.recipe) {
        let failureMessage = body.error ?? (isEdit ? "Unable to update recipe" : "Unable to create recipe");

        if (Array.isArray(body.issues) && body.issues.length > 0) {
          const mappedErrors = buildFieldErrors(body.issues, {
            ingredientIds,
            prepTaskIds,
            cookStepIds
          });
          setFieldErrors(mappedErrors);
          if (mappedErrors.form && mappedErrors.form.length > 0) {
            failureMessage = mappedErrors.form.join("; ");
          } else if (body.detail) {
            failureMessage = body.detail;
          }
        } else if (body.detail) {
          failureMessage = body.detail;
        }

        throw new Error(failureMessage);
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
        <input
          required
          className={inputClass("title")}
          value={title}
          onChange={(event) => setTitle(event.target.value)}
        />
        {fieldErrorText("title")}
      </label>

      <label>
        Description
        <textarea
          rows={4}
          className={inputClass("description")}
          value={description}
          onChange={(event) => setDescription(event.target.value)}
        />
        {fieldErrorText("description")}
      </label>

      <div className={styles.metaBlock}>
        <label htmlFor="recipe-tags">
          Tags
        </label>
        <div className={fieldError("tags") ? styles.fieldErrorControl : undefined}>
          <TagsInput values={tags} onChange={setTags} />
        </div>
        {fieldErrorText("tags")}
      </div>

      <div className="row">
        <label>
          Collection
          <select
            className={inputClass("collectionId")}
            value={collectionId}
            onChange={(event) => setCollectionId(event.target.value)}
          >
            {writableCollections.length === 0 ? (
              <option value="">No writable collections</option>
            ) : null}
            {writableCollections.map((collection) => (
              <option key={collection.id} value={collection.id}>
                {collection.name}
              </option>
            ))}
          </select>
          {fieldErrorText("collectionId")}
        </label>
      </div>

      <div className="row">
        <label>
          Source type
          <select
            className={inputClass("sourceType")}
            value={sourceType}
            onChange={(event) => setSourceType(event.target.value as SourceType)}
          >
            {SOURCE_TYPE_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
          {fieldErrorText("sourceType")}
        </label>
        <label>
          Source ref
          <input
            className={inputClass("sourceRef")}
            value={sourceRef}
            onChange={(event) => setSourceRef(event.target.value)}
          />
          {fieldErrorText("sourceRef")}
        </label>
      </div>

      <div className="row">
        <label>
          Hero image URL
          <input
            className={inputClass("heroPhotoUrl")}
            value={heroPhotoUrl}
            onChange={(event) => setHeroPhotoUrl(event.target.value)}
          />
          {fieldErrorText("heroPhotoUrl")}
        </label>
        <label>
          Servings
          <input
            type="number"
            min="1"
            className={inputClass("servingCount")}
            value={servings}
            onChange={(event) => setServings(event.target.value)}
          />
          {fieldErrorText("servingCount")}
        </label>
        <label>
          Total minutes
          <input
            type="number"
            min="1"
            className={inputClass("timeRequiredMinutes")}
            value={minutes}
            onChange={(event) => setMinutes(event.target.value)}
          />
          {fieldErrorText("timeRequiredMinutes")}
        </label>
      </div>

      <div className={styles.inlineField}>
        <span className={styles.metaLabel}>Replace hero image by upload</span>
        <input
          type="file"
          accept="image/*"
          onChange={(event) => {
            const file = event.target.files?.[0] ?? null;
            void onUploadHeroPhoto(file);
            event.currentTarget.value = "";
          }}
          disabled={heroUploading || saving || deleting}
        />
        {heroUploading ? <p className="muted">Uploading image...</p> : null}
        {heroUploadError ? <p className={styles.fieldError}>{heroUploadError}</p> : null}
      </div>

      <section className={styles.section}>
        <h3 className={styles.sectionTitle}>Ingredients</h3>
        {fieldErrorText("ingredients")}
        {ingredients.map((ingredient) => {
          const nameKey = `ingredient:${ingredient.id}:name`;
          const quantityKey = `ingredient:${ingredient.id}:quantity`;
          const wholeKey = `ingredient:${ingredient.id}:isWholeItem`;
          const optionalKey = `ingredient:${ingredient.id}:optional`;
          const pantryKey = `ingredient:${ingredient.id}:isPantryItem`;

          return (
            <div key={ingredient.id} className={`card ${styles.itemCard}`}>
              <RemoveXButton
                label="Remove ingredient"
                onClick={() => setIngredients((previous) => previous.filter((item) => item.id !== ingredient.id))}
                disabled={ingredients.length === 1}
              />
              <div className={styles.ingredientTopRow}>
                <div className={styles.ingredientNameField}>
                  <input
                    aria-label="Ingredient name"
                    className={inputClass(nameKey)}
                    value={ingredient.name}
                    placeholder="Ingredient"
                    onChange={(event) =>
                      setIngredients((previous) =>
                        previous.map((item) =>
                          item.id === ingredient.id ? { ...item, name: event.target.value } : item
                        )
                      )
                    }
                  />
                  {fieldErrorText(nameKey)}
                </div>
                <div className={styles.ingredientQuantityField}>
                  <input
                    aria-label="Ingredient quantity"
                    className={inputClass(quantityKey)}
                    value={ingredient.quantity}
                    placeholder="e.g. 2, 1/2 tbsp"
                    onChange={(event) =>
                      setIngredients((previous) =>
                        previous.map((item) =>
                          item.id === ingredient.id ? { ...item, quantity: event.target.value } : item
                        )
                      )
                    }
                  />
                  {fieldErrorText(quantityKey)}
                </div>
              </div>
              <div className={`row ${styles.checkboxRow}`}>
                <label className={styles.checkboxLabel} title="For indivisible items like eggs or cloves so scaling rounds to a whole number.">
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
                <label className={styles.checkboxLabel} title="Optional means this can be skipped without breaking the recipe.">
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
                <label className={styles.checkboxLabel} title="Pantry items are usually assumed to be on hand and are shown separately in recipe view.">
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
              {fieldErrorText(wholeKey)}
              {fieldErrorText(optionalKey)}
              {fieldErrorText(pantryKey)}
              {fieldErrorText(`ingredient:${ingredient.id}:row`)}
            </div>
          );
        })}
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

      <section className={`${styles.section} ${styles.sectionDivider}`}>
        <h3 className={styles.sectionTitle}>Prep tasks</h3>
        {fieldErrorText("prepTasks")}
        {prepTasks.map((task) => {
          const nameKey = `prep:${task.id}:preparationName`;
          const detailKey = `prep:${task.id}:detail`;
          const sourceKey = `prep:${task.id}:sourceIngredients`;

          return (
            <div key={task.id} className={`card ${styles.itemCard}`}>
              <RemoveXButton
                label="Remove prep task"
                onClick={() => setPrepTasks((previous) => previous.filter((item) => item.id !== task.id))}
              />
              <label>
                Preparation name
                <input
                  className={inputClass(nameKey)}
                  value={task.preparationName}
                  onChange={(event) =>
                    setPrepTasks((previous) =>
                      previous.map((item) =>
                        item.id === task.id ? { ...item, preparationName: event.target.value } : item
                      )
                    )
                  }
                />
                {fieldErrorText(nameKey)}
              </label>
              <div className={styles.inlineField}>
                <label htmlFor={`prep-source-${task.id}`}>
                  Source ingredients
                </label>
                <div className={fieldError(sourceKey) ? styles.fieldErrorControl : undefined}>
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
                {fieldErrorText(sourceKey)}
              </div>
              <label>
                Detail
                <textarea
                  rows={2}
                  className={inputClass(detailKey)}
                  value={task.detail}
                  onChange={(event) =>
                    setPrepTasks((previous) =>
                      previous.map((item) => (item.id === task.id ? { ...item, detail: event.target.value } : item))
                    )
                  }
                />
                {fieldErrorText(detailKey)}
              </label>
              {fieldErrorText(`prep:${task.id}:row`)}
            </div>
          );
        })}
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

      <section className={`${styles.section} ${styles.sectionDivider}`}>
        <h3 className={styles.sectionTitle}>Cook steps</h3>
        {fieldErrorText("cookSteps")}
        <div ref={cookStepsListRef} className={styles.sortableList}>
          {cookSteps.map((step) => {
          const instructionKey = `cook:${step.id}:instruction`;
          const timerKey = `cook:${step.id}:timerSeconds`;
          const detailKey = `cook:${step.id}:detail`;
          const sourceKey = `cook:${step.id}:sourceIngredients`;

          return (
            <div
              key={step.id}
              className={`card ${styles.itemCard} ${styles.sortableItem}`}
            >
              <button
                type="button"
                className={styles.dragHandle}
                onClick={(event) => event.preventDefault()}
                title="Drag to reorder step"
                aria-label="Drag to reorder step"
              >
                <span className={styles.dragHandleBar} aria-hidden />
                <span className={styles.dragHandleBar} aria-hidden />
                <span className={styles.dragHandleBar} aria-hidden />
              </button>
              <RemoveXButton
                label="Remove cook step"
                onClick={() => setCookSteps((previous) => previous.filter((item) => item.id !== step.id))}
                disabled={cookSteps.length === 1}
              />
              <div className={styles.cookTopRow}>
                <label className={styles.cookInstructionField}>
                  Instruction
                  <input
                    className={inputClass(instructionKey)}
                    value={step.instruction}
                    onChange={(event) =>
                      setCookSteps((previous) =>
                        previous.map((item) =>
                          item.id === step.id ? { ...item, instruction: event.target.value } : item
                        )
                      )
                    }
                  />
                  {fieldErrorText(instructionKey)}
                </label>
                <label className={styles.timerField}>
                  Timer
                  <input
                    type="number"
                    min="0"
                    className={inputClass(timerKey)}
                    value={step.timerSeconds}
                    onChange={(event) =>
                      setCookSteps((previous) =>
                        previous.map((item) =>
                          item.id === step.id ? { ...item, timerSeconds: event.target.value } : item
                        )
                      )
                    }
                  />
                  {fieldErrorText(timerKey)}
                </label>
              </div>
              <label>
                Detail
                <textarea
                  rows={2}
                  className={inputClass(detailKey)}
                  value={step.detail}
                  onChange={(event) =>
                    setCookSteps((previous) =>
                      previous.map((item) => (item.id === step.id ? { ...item, detail: event.target.value } : item))
                    )
                  }
                />
                {fieldErrorText(detailKey)}
              </label>
              <div className={styles.inlineField}>
                <label htmlFor={`cook-source-${step.id}`}>
                  Source ingredients
                </label>
                <div className={fieldError(sourceKey) ? styles.fieldErrorControl : undefined}>
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
                {fieldErrorText(sourceKey)}
              </div>
              {fieldErrorText(`cook:${step.id}:row`)}
            </div>
          );
          })}
        </div>
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

      {fieldErrorText("form")}
      <div className={`row ${styles.actions}`}>
        <button type="submit" disabled={saving || deleting || heroUploading}>
          {saving ? (isEdit ? "Saving..." : "Creating...") : isEdit ? "Save changes" : "Create recipe"}
        </button>
        {isEdit ? (
          <button type="button" className="secondary" disabled={saving || deleting || heroUploading} onClick={() => void onDelete()}>
            {deleting ? "Deleting..." : "Delete recipe"}
          </button>
        ) : null}
      </div>
      {error ? <p className={styles.error}>{error}</p> : null}
    </form>
  );
}
