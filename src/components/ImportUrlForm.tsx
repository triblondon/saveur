"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface ImportResponse {
  recipeId: string;
  importRunId: string;
  status: "SUCCESS" | "PARTIAL" | "FAILED";
  usable: boolean;
  warnings: string[];
  adapter: string;
}

export function ImportUrlForm() {
  const router = useRouter();
  const [url, setUrl] = useState("");
  const [prompt, setPrompt] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ImportResponse | null>(null);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const response = await fetch("/api/import/url", {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({
          url,
          prompt: prompt.trim() || null
        })
      });

      const payload = (await response.json()) as ImportResponse | { error?: string };
      if (!response.ok) {
        setError((payload as { error?: string }).error ?? "Import failed");
        return;
      }

      const importResult = payload as ImportResponse;
      setResult(importResult);

      if (importResult.recipeId) {
        router.push(`/recipes/${importResult.recipeId}`);
        router.refresh();
      }
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Import failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form className="card" onSubmit={onSubmit} style={{ display: "grid", gap: 12 }}>
      <label htmlFor="sourceUrl">Gousto recipe URL</label>
      <input
        id="sourceUrl"
        type="url"
        value={url}
        required
        placeholder="https://www.gousto.co.uk/cookbook/..."
        onChange={(event) => setUrl(event.target.value)}
      />
      <label htmlFor="importPrompt">Import prompt (optional)</label>
      <textarea
        id="importPrompt"
        rows={4}
        value={prompt}
        placeholder="e.g. Prefer shorter cook steps and include explicit prep for sauces."
        onChange={(event) => setPrompt(event.target.value)}
      />
      <button type="submit" disabled={loading}>
        {loading ? "Importing..." : "Import recipe"}
      </button>

      {error ? <p style={{ color: "#a22525", margin: 0 }}>{error}</p> : null}
      {result ? (
        <div className="muted">
          <p style={{ marginBottom: 6, marginTop: 0 }}>
            Import status: {result.status} ({result.adapter})
          </p>
          {result.warnings.length ? <p style={{ margin: 0 }}>Warnings: {result.warnings.join("; ")}</p> : null}
        </div>
      ) : null}
    </form>
  );
}
