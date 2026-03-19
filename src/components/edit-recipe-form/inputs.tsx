import { useMemo } from "react";
import { ReactTags, type Tag } from "react-tag-autocomplete";
import styles from "@/components/styles/edit-recipe-form.module.css";

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

function normalizeTagLabel(value: string): string {
  return value
    .trim()
    .replace(/\s+/g, " ");
}

export function RemoveXButton(props: { label: string; onClick: () => void; disabled?: boolean }) {
  const { label, onClick, disabled } = props;
  return (
    <button
      type="button"
      className={`secondary ${styles.removeButton}`}
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
    >
      x
    </button>
  );
}

export function TagsInput(props: { values: string[]; onChange: (next: string[]) => void }) {
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

interface NameListInputProps {
  id: string;
  labelText: string;
  values: string[];
  suggestions: string[];
  placeholderText: string;
  onChange: (next: string[]) => void;
}

export function NameListInput(props: NameListInputProps) {
  const { id, labelText, values, suggestions, placeholderText, onChange } = props;

  const selected = useMemo<Tag[]>(
    () =>
      values.map((label) => ({
        label,
        value: label.toLowerCase()
      })),
    [values]
  );

  const available = useMemo<Tag[]>(() => {
    const seen = new Set<string>();
    const labels: string[] = [];

    for (const label of suggestions) {
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
  }, [suggestions]);

  return (
    <ReactTags
      id={id}
      labelText={labelText}
      selected={selected}
      suggestions={available}
      allowNew
      newOptionText="Add: %value%"
      placeholderText={placeholderText}
      noOptionsText="No matching items"
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
    />
  );
}

