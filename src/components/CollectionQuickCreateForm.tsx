"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import styles from "@/components/styles/collection-controls.module.css";

export function CollectionQuickCreateForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [visibility, setVisibility] = useState<"private" | "public">("private");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const response = await fetch("/api/collections", {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim() || null,
          visibility
        })
      });
      const body = (await response.json()) as { collection?: { id: string }; error?: string };
      if (!response.ok || !body.collection) {
        throw new Error(body.error ?? "Unable to create collection");
      }
      router.push(`/collections/${body.collection.id}`);
      router.refresh();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Unable to create collection");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className={`card ${styles.form}`} onSubmit={onSubmit}>
      <h2 className={styles.heading}>Create collection</h2>
      <label>
        Name
        <input required value={name} onChange={(event) => setName(event.target.value)} />
      </label>
      <label>
        Description
        <textarea value={description} rows={2} onChange={(event) => setDescription(event.target.value)} />
      </label>
      <label>
        Visibility
        <select value={visibility} onChange={(event) => setVisibility(event.target.value as "private" | "public")}>
          <option value="private">Private</option>
          <option value="public">Public</option>
        </select>
      </label>
      <button type="submit" disabled={submitting}>
        {submitting ? "Creating..." : "Create collection"}
      </button>
      {error ? <p className={styles.error}>{error}</p> : null}
    </form>
  );
}
