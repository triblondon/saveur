"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Recipe } from "@/lib/types";
import styles from "@/components/styles/recipe-view.module.css";

interface RecipeActionsCardProps {
  recipe: Pick<Recipe, "id" | "sourceType" | "importPrompt">;
  latestImportWarnings: string[];
  canEdit: boolean;
}

export function RecipeActionsCard({ recipe, latestImportWarnings, canEdit }: RecipeActionsCardProps) {
  const router = useRouter();
  const [reimporting, setReimporting] = useState(false);
  const [reimportError, setReimportError] = useState<string | null>(null);
  const [showReimportPrompt, setShowReimportPrompt] = useState(false);
  const [reimportPromptDraft, setReimportPromptDraft] = useState(recipe.importPrompt ?? "");

  async function onReimportWithPrompt(prompt: string) {
    setReimporting(true);
    setReimportError(null);

    try {
      const response = await fetch(`/api/recipes/${recipe.id}/reimport`, {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({
          prompt: prompt.trim() || null
        })
      });

      const body = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(body.error ?? "Reimport failed");
      }

      setShowReimportPrompt(false);
      router.refresh();
    } catch (requestError) {
      setReimportError(requestError instanceof Error ? requestError.message : "Reimport failed");
    } finally {
      setReimporting(false);
    }
  }

  return (
    <article className={`card ${styles.actionsFooter}`}>
      <div className={`row ${styles.actionsRow}`}>
        {canEdit ? (
          <Link href={`/recipes/${recipe.id}/edit`} className={`secondary ${styles.actionLink}`}>
            Edit recipe
          </Link>
        ) : null}
        {canEdit && recipe.sourceType === "URL" && !showReimportPrompt ? (
          <button
            type="button"
            className="secondary"
            onClick={() => setShowReimportPrompt(true)}
            disabled={reimporting}
          >
            {reimporting ? "Reimporting..." : "Reimport with prompt"}
          </button>
        ) : null}
      </div>
      {canEdit && recipe.sourceType === "URL" && showReimportPrompt ? (
        <div className={`card ${styles.reimportPromptCard}`}>
          {latestImportWarnings.length > 0 ? (
            <div className={styles.importWarnings}>
              <p className={styles.importWarningsTitle}>Last import warnings</p>
              <ul className={styles.importWarningsList}>
                {latestImportWarnings.map((warning, index) => (
                  <li key={`${warning}-${index}`}>{warning}</li>
                ))}
              </ul>
            </div>
          ) : null}
          <label htmlFor="reimportPrompt">Reimport prompt (optional)</label>
          <textarea
            id="reimportPrompt"
            rows={4}
            value={reimportPromptDraft}
            onChange={(event) => setReimportPromptDraft(event.target.value)}
          />
          <div className="row">
            <button
              type="button"
              className="secondary"
              onClick={() => setShowReimportPrompt(false)}
              disabled={reimporting}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => void onReimportWithPrompt(reimportPromptDraft)}
              disabled={reimporting}
            >
              {reimporting ? "Reimporting..." : "Run reimport"}
            </button>
          </div>
        </div>
      ) : null}
      {reimportError ? <p className={styles.error}>{reimportError}</p> : null}
    </article>
  );
}
