"use client";

import Link from "next/link";
import Image from "next/image";
import ReactMarkdown from "react-markdown";
import { useRouter } from "next/navigation";
import { useMemo, useState, useEffect, useRef } from "react";
import type { Recipe } from "@/lib/types";
import { scaleValue } from "@/lib/scaling";
import styles from "@/components/styles/recipe-view.module.css";

function formatSeconds(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function TimerIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path
        fill="currentColor"
        d="M15 1H9v2h6zM11 14h2V8h-2zm8.03-6.39 1.42-1.42a9.14 9.14 0 0 0-1.42-1.42l-1.42 1.42A7.92 7.92 0 0 0 13 5a8 8 0 1 0 8 8c0-1.57-.42-3.04-1.17-4.39M13 19a6 6 0 1 1 0-12 6 6 0 0 1 0 12"
      />
    </svg>
  );
}

interface StickyTimer {
  stepId: string;
  instruction: string;
  remaining: number;
  rank: number;
}

interface StepTimerState {
  endAt: number | null;
  pausedRemaining: number | null;
}

type TimerStatus = "idle" | "running" | "paused" | "done";

interface StepTimerInfo {
  status: TimerStatus;
  remainingSeconds: number;
  durationSeconds: number;
}

const CREATED_DATE_FORMATTER = new Intl.DateTimeFormat("en-GB", {
  year: "numeric",
  month: "short",
  day: "numeric",
  timeZone: "UTC"
});

function PauseIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path fill="currentColor" d="M6 19h4V5H6zm8-14v14h4V5z" />
    </svg>
  );
}

function CancelIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path
        fill="currentColor"
        d="M19 6.41 17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"
      />
    </svg>
  );
}

interface RecipeViewProps {
  recipe: Recipe;
}

export function RecipeView({ recipe }: RecipeViewProps) {
  const router = useRouter();
  const [servings, setServings] = useState<number>(recipe.servingCount ?? 2);
  const [timerStates, setTimerStates] = useState<Record<string, StepTimerState>>({});
  const [now, setNow] = useState<number>(() => Date.now());
  const [viewportVersion, setViewportVersion] = useState(0);
  const [hoveredTimerStepId, setHoveredTimerStepId] = useState<string | null>(null);
  const [reimporting, setReimporting] = useState(false);
  const [reimportError, setReimportError] = useState<string | null>(null);
  const [showReimportPrompt, setShowReimportPrompt] = useState(false);
  const [reimportPromptDraft, setReimportPromptDraft] = useState(recipe.importPrompt ?? "");
  const cookStepRefs = useRef<Record<string, HTMLLIElement | null>>({});

  useEffect(() => {
    const interval = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    let frameId: number | null = null;
    const requestTick = () => {
      if (frameId !== null) {
        return;
      }

      frameId = window.requestAnimationFrame(() => {
        frameId = null;
        setViewportVersion((previous) => previous + 1);
      });
    };

    window.addEventListener("scroll", requestTick, { passive: true });
    window.addEventListener("resize", requestTick);
    requestTick();

    return () => {
      window.removeEventListener("scroll", requestTick);
      window.removeEventListener("resize", requestTick);
      if (frameId !== null) {
        window.cancelAnimationFrame(frameId);
      }
    };
  }, []);

  useEffect(() => {
    setReimportPromptDraft(recipe.importPrompt ?? "");
  }, [recipe.importPrompt]);

  function startTimer(stepId: string, durationSeconds: number) {
    setTimerStates((previous) => {
      const pausedRemaining = previous[stepId]?.pausedRemaining;
      const startFrom = pausedRemaining && pausedRemaining > 0 ? pausedRemaining : durationSeconds;

      return {
        ...previous,
        [stepId]: {
          endAt: Date.now() + startFrom * 1000,
          pausedRemaining: null
        }
      };
    });
  }

  function pauseTimer(stepId: string) {
    setTimerStates((previous) => {
      const current = previous[stepId];
      if (!current?.endAt) {
        return previous;
      }

      const remaining = Math.max(0, Math.floor((current.endAt - Date.now()) / 1000));
      return {
        ...previous,
        [stepId]: {
          endAt: null,
          pausedRemaining: remaining
        }
      };
    });
  }

  function cancelTimer(stepId: string) {
    setTimerStates((previous) => {
      if (!previous[stepId]) {
        return previous;
      }

      const next = { ...previous };
      delete next[stepId];
      return next;
    });
  }

  const ingredientsWithQuantity = useMemo(
    () =>
      recipe.ingredients.map((ingredient) => ({
        ingredient,
        quantity: (() => {
          if (ingredient.quantityValue && recipe.servingCount && recipe.servingCount > 0) {
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

  const timerInfoByStep = useMemo(() => {
    const infoByStep: Record<string, StepTimerInfo> = {};

    for (const [index, step] of recipe.cookSteps.entries()) {
      const stepKey = String(index);
      if (!step.timerSeconds) {
        continue;
      }

      const durationSeconds = step.timerSeconds;
      const current = timerStates[stepKey];
      if (!current) {
        infoByStep[stepKey] = {
          status: "idle",
          remainingSeconds: durationSeconds,
          durationSeconds
        };
        continue;
      }

      if (current.pausedRemaining !== null) {
        infoByStep[stepKey] = {
          status: "paused",
          remainingSeconds: Math.max(0, current.pausedRemaining),
          durationSeconds
        };
        continue;
      }

      if (current.endAt !== null) {
        const remaining = Math.max(0, Math.floor((current.endAt - now) / 1000));
        infoByStep[stepKey] = {
          status: remaining === 0 ? "done" : "running",
          remainingSeconds: remaining,
          durationSeconds
        };
        continue;
      }

      infoByStep[stepKey] = {
        status: "idle",
        remainingSeconds: durationSeconds,
        durationSeconds
      };
    }

    return infoByStep;
  }, [recipe.cookSteps, timerStates, now]);

  const stickyTimers = useMemo(() => {
    if (viewportVersion < 0) {
      return { top: [] as StickyTimer[], bottom: [] as StickyTimer[] };
    }

    if (typeof window === "undefined") {
      return { top: [] as StickyTimer[], bottom: [] as StickyTimer[] };
    }

    const top: StickyTimer[] = [];
    const bottom: StickyTimer[] = [];
    const viewportHeight = window.innerHeight;

    for (const [index, step] of recipe.cookSteps.entries()) {
      const stepKey = String(index);
      const timerInfo = timerInfoByStep[stepKey];
      if (!timerInfo || timerInfo.status !== "running") {
        continue;
      }

      const element = cookStepRefs.current[stepKey];
      if (!element) {
        continue;
      }

      const rect = element.getBoundingClientRect();
      if (rect.bottom < 0) {
        top.push({
          stepId: stepKey,
          instruction: step.instruction,
          remaining: timerInfo.remainingSeconds,
          rank: rect.bottom
        });
      } else if (rect.top > viewportHeight) {
        bottom.push({
          stepId: stepKey,
          instruction: step.instruction,
          remaining: timerInfo.remainingSeconds,
          rank: rect.top
        });
      }
    }

    top.sort((a, b) => b.rank - a.rank);
    bottom.sort((a, b) => a.rank - b.rank);

    return { top, bottom };
  }, [recipe.cookSteps, timerInfoByStep, viewportVersion]);

  function scrollToCookStep(stepId: string) {
    const element = cookStepRefs.current[stepId];
    if (!element) {
      return;
    }

    element.scrollIntoView({
      behavior: "smooth",
      block: "center"
    });
  }

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
    <section className={styles.section}>
      <article className={`card ${styles.headerCard}`}>
        <div className={styles.headerTop}>
          {recipe.heroPhotoUrl ? (
            <Image
              src={recipe.heroPhotoUrl}
              alt={recipe.title}
              className={styles.heroImage}
              width={1200}
              height={700}
            />
          ) : null}
          <div className={styles.headerMeta}>
            <h2 className={styles.title}>{recipe.title}</h2>
            {recipe.description ? <p className={styles.description}>{recipe.description}</p> : null}
            {recipe.tags.length > 0 ? (
              <ul className={`inline-list ${styles.tagList}`}>
                {recipe.tags.map((tag) => (
                  <li className="tag" key={tag}>
                    {tag}
                  </li>
                ))}
              </ul>
            ) : null}
            <div className={`row ${styles.metaRow}`}>
              <label>
                Servings
                <select value={String(servings)} onChange={(event) => setServings(Number(event.target.value))}>
                  {servingsOptions.map((value) => (
                    <option key={value} value={value}>
                      {value}
                    </option>
                  ))}
                </select>
              </label>
              <div>
                <p className={`muted ${styles.metricLabel}`}>Total time</p>
                <strong>{recipe.timeRequiredMinutes ? `${recipe.timeRequiredMinutes} minutes` : "Not set"}</strong>
              </div>
              <div>
                <p className={`muted ${styles.metricLabel}`}>Source</p>
                <strong className={styles.sourceValue}>{sourceLabel}</strong>
              </div>
              <div>
                <p className={`muted ${styles.metricLabel}`}>{recipe.sourceType === "URL" ? "Imported" : "Created"}</p>
                <strong>{createdLabel}</strong>
              </div>
            </div>
          </div>
        </div>
      </article>

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

      {recipe.prepTasks.length > 0 ? (
        <article className="card">
          <h3 className={styles.prepTitle}>Prep tasks</h3>
          <ol className={styles.prepList}>
            {recipe.prepTasks.map((task, index) => (
              <li key={`${index}-${task.preparationName}`} className={styles.prepItem}>
                <strong>{task.preparationName}</strong>
                {task.detail ? (
                  <div className={styles.prepDetail}>
                    <ReactMarkdown>{task.detail}</ReactMarkdown>
                  </div>
                ) : null}
              </li>
            ))}
          </ol>
        </article>
      ) : null}

      <article className="card">
        <h3 className={styles.cookTitle}>Cook steps</h3>
        <ol className={styles.cookList}>
          {recipe.cookSteps.map((step, index) => {
            const stepKey = String(index);
            const timerInfo = step.timerSeconds ? timerInfoByStep[stepKey] : null;
            const timerStatus: TimerStatus = timerInfo?.status ?? "idle";
            const isHovered = hoveredTimerStepId === stepKey;
            const timerButtonLabel = (() => {
              if (!timerInfo) {
                return "";
              }

              if (timerStatus === "running") {
                return formatSeconds(timerInfo.remainingSeconds);
              }

              if (timerStatus === "paused") {
                return `Resume ${formatSeconds(timerInfo.remainingSeconds)}`;
              }

              if (timerStatus === "done") {
                return `Restart ${Math.round(timerInfo.durationSeconds / 60)} min`;
              }

              return `Start ${Math.round(timerInfo.durationSeconds / 60)} min`;
            })();

            return (
              <li
                key={`${index}-${step.instruction}`}
                ref={(element) => {
                  cookStepRefs.current[stepKey] = element;
                }}
                className={styles.cookItem}
              >
                <div className={styles.cookHeader}>
                  <strong className={styles.stepTitle}>{step.instruction}</strong>
                  {step.timerSeconds ? (
                    <div
                      className={`${styles.timerShell} ${
                        timerStatus === "idle" && isHovered ? styles.timerShellIdleHover : ""
                      }`}
                      onMouseEnter={() => setHoveredTimerStepId(stepKey)}
                      onMouseLeave={() =>
                        setHoveredTimerStepId((previous) => (previous === stepKey ? null : previous))
                      }
                    >
                      <div
                        className={`${styles.timerControls} ${
                          timerStatus === "running" && isHovered ? styles.timerControlsVisible : ""
                        }`}
                      >
                        <button
                          type="button"
                          aria-label={`Pause timer for ${step.instruction}`}
                          onClick={() => pauseTimer(stepKey)}
                          className={styles.timerControlButton}
                        >
                          <PauseIcon />
                        </button>
                        <button
                          type="button"
                          aria-label={`Cancel timer for ${step.instruction}`}
                          onClick={() => cancelTimer(stepKey)}
                          className={styles.timerControlButton}
                        >
                          <CancelIcon />
                        </button>
                      </div>
                      <button
                        type="button"
                        onClick={() => startTimer(stepKey, step.timerSeconds!)}
                        className={styles.timerMainButton}
                      >
                        <TimerIcon />
                        {timerButtonLabel}
                      </button>
                    </div>
                  ) : null}
                </div>
                {step.detail ? (
                  <div className={styles.stepDetail}>
                    <ReactMarkdown>{step.detail}</ReactMarkdown>
                  </div>
                ) : null}
              </li>
            );
          })}
        </ol>
      </article>

      <article className={`card ${styles.actionsFooter}`}>
        <div className={`row ${styles.actionsRow}`}>
          <Link href={`/recipes/${recipe.id}/edit`} className={`secondary ${styles.actionLink}`}>
            Edit recipe
          </Link>
          {recipe.sourceType === "URL" && !showReimportPrompt ? (
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
        {recipe.sourceType === "URL" && showReimportPrompt ? (
          <div className={`card ${styles.reimportPromptCard}`}>
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

      {stickyTimers.top.length > 0 ? (
        <div className={styles.stickyContainerTop}>
          {stickyTimers.top.map((timer) => (
            <button
              key={`top-${timer.stepId}`}
              type="button"
              className={`secondary ${styles.stickyTimerButton}`}
              onClick={() => scrollToCookStep(timer.stepId)}
            >
              <TimerIcon />
              <strong>{timer.instruction}</strong>
              <span>{formatSeconds(timer.remaining)}</span>
            </button>
          ))}
        </div>
      ) : null}

      {stickyTimers.bottom.length > 0 ? (
        <div className={styles.stickyContainerBottom}>
          {stickyTimers.bottom.map((timer) => (
            <button
              key={`bottom-${timer.stepId}`}
              type="button"
              className={`secondary ${styles.stickyTimerButton}`}
              onClick={() => scrollToCookStep(timer.stepId)}
            >
              <TimerIcon />
              <strong>{timer.instruction}</strong>
              <span>{formatSeconds(timer.remaining)}</span>
            </button>
          ))}
        </div>
      ) : null}
    </section>
  );
}
