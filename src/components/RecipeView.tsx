"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useEffect, useRef } from "react";
import type { Recipe } from "@/lib/types";
import { scaleValue } from "@/lib/scaling";

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
  const [wakeLockState, setWakeLockState] = useState<"unsupported" | "enabled" | "disabled">(
    "disabled"
  );
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
    let released = false;
    let lock: WakeLockSentinel | null = null;

    async function enableWakeLock() {
      if (!("wakeLock" in navigator) || !navigator.wakeLock?.request) {
        setWakeLockState("unsupported");
        return;
      }

      try {
        lock = await navigator.wakeLock.request("screen");
        if (!released) {
          setWakeLockState("enabled");
        }
      } catch {
        if (!released) {
          setWakeLockState("disabled");
        }
      }
    }

    void enableWakeLock();

    return () => {
      released = true;
      if (lock && !lock.released) {
        void lock.release();
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

  const timerInfoByStep = useMemo(() => {
    const infoByStep: Record<string, StepTimerInfo> = {};

    for (const step of recipe.cookSteps) {
      if (!step.timerSeconds) {
        continue;
      }

      const durationSeconds = step.timerSeconds;
      const current = timerStates[step.id];
      if (!current) {
        infoByStep[step.id] = {
          status: "idle",
          remainingSeconds: durationSeconds,
          durationSeconds
        };
        continue;
      }

      if (current.pausedRemaining !== null) {
        infoByStep[step.id] = {
          status: "paused",
          remainingSeconds: Math.max(0, current.pausedRemaining),
          durationSeconds
        };
        continue;
      }

      if (current.endAt !== null) {
        const remaining = Math.max(0, Math.floor((current.endAt - now) / 1000));
        infoByStep[step.id] = {
          status: remaining === 0 ? "done" : "running",
          remainingSeconds: remaining,
          durationSeconds
        };
        continue;
      }

      infoByStep[step.id] = {
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

    for (const step of recipe.cookSteps) {
      const timerInfo = timerInfoByStep[step.id];
      if (!timerInfo || timerInfo.status !== "running") {
        continue;
      }

      const element = cookStepRefs.current[step.id];
      if (!element) {
        continue;
      }

      const rect = element.getBoundingClientRect();
      if (rect.bottom < 0) {
        top.push({
          stepId: step.id,
          instruction: step.instruction,
          remaining: timerInfo.remainingSeconds,
          rank: rect.bottom
        });
      } else if (rect.top > viewportHeight) {
        bottom.push({
          stepId: step.id,
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
    <section>
      <article className="card">
        {recipe.heroPhotoUrl ? (
          <img
            src={recipe.heroPhotoUrl}
            alt={recipe.title}
            style={{
              width: "100%",
              maxHeight: 340,
              objectFit: "cover",
              borderRadius: 12,
              marginBottom: 12
            }}
          />
        ) : null}
        <h2 style={{ marginTop: 0 }}>{recipe.title}</h2>
        <p className="muted" style={{ marginTop: 0 }}>
          Wake lock: {wakeLockState}
        </p>
        <p style={{ marginTop: 0 }}>
          <Link href={`/recipes/${recipe.id}/edit`}>Edit recipe</Link>
        </p>
        {recipe.sourceType === "URL" ? (
          <div style={{ marginTop: 0, display: "grid", gap: 8 }}>
            {!showReimportPrompt ? (
              <p style={{ marginTop: 0, marginBottom: 0 }}>
                <button
                  type="button"
                  className="secondary"
                  onClick={() => setShowReimportPrompt(true)}
                  disabled={reimporting}
                >
                  {reimporting ? "Reimporting..." : "Reimport with prompt"}
                </button>
              </p>
            ) : (
              <div className="card" style={{ marginBottom: 0, display: "grid", gap: 8 }}>
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
            )}
          </div>
        ) : null}
        {reimportError ? <p style={{ marginTop: 0, color: "#a22525" }}>{reimportError}</p> : null}

        <div className="row">
          <label>
            Servings
            <input
              type="number"
              min={1}
              step={1}
              value={servings}
              onChange={(event) => setServings(Math.max(1, Number(event.target.value) || 1))}
            />
          </label>
          <div>
            <p className="muted" style={{ marginBottom: 4 }}>
              Total time
            </p>
            <strong>
              {recipe.timeRequiredMinutes ? `${recipe.timeRequiredMinutes} minutes` : "Not set"}
            </strong>
          </div>
          <div>
            <p className="muted" style={{ marginBottom: 4 }}>
              Source
            </p>
            <strong>{recipe.sourceType}</strong>
          </div>
        </div>
      </article>

      <article className="card">
        <h3 style={{ marginTop: 0 }}>Ingredients</h3>
        {mainIngredients.length > 0 ? (
          <table style={{ minWidth: "50%",borderCollapse: "collapse" }}>
            <tbody>
              {mainIngredients.map(({ ingredient, quantity }) => (
                <tr key={ingredient.id}>
                  <td style={{ padding: "6px 0", borderTop: "1px solid var(--line)" }}>{ingredient.name}</td>
                  <td style={{ padding: "6px 0", textAlign: "right", borderTop: "1px solid var(--line)" }}>
                    {quantity}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : null}
        {mainIngredients.length === 0 ? <p className="muted">All ingredients are pantry items.</p> : null}
        {pantryIngredients.length > 0 ? (
          <p className="muted" style={{ marginBottom: 0 }}>
            Also: {pantryIngredients.map(({ ingredient }) => ingredient.name).join(", ")}
          </p>
        ) : null}
      </article>

      {recipe.prepTasks.length > 0 ? (
        <article className="card">
          <h3 style={{ marginTop: 0 }}>Prep tasks</h3>
          <ol style={{ margin: 0, paddingLeft: 20 }}>
            {recipe.prepTasks.map((task) => (
              <li key={task.id} style={{ marginBottom: 8 }}>
                <strong>{task.title}</strong>
                {task.detail ? <div className="muted">{task.detail}</div> : null}
              </li>
            ))}
          </ol>
        </article>
      ) : null}

      <article className="card">
        <h3 style={{ marginTop: 0 }}>Cook steps</h3>
        <ol style={{ margin: 0, paddingLeft: 20 }}>
          {recipe.cookSteps.map((step) => {
            const timerInfo = step.timerSeconds ? timerInfoByStep[step.id] : null;
            const timerStatus: TimerStatus = timerInfo?.status ?? "idle";
            const isHovered = hoveredTimerStepId === step.id;
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
                key={step.id}
                ref={(element) => {
                  cookStepRefs.current[step.id] = element;
                }}
                style={{ marginBottom: 14 }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 10,
                    marginBottom: 6
                  }}
                >
                  <strong>{step.instruction}</strong>
                  {step.timerSeconds ? (
                    <div
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        background: "#ece4d6",
                        color: "#30291f",
                        borderRadius: 10,
                        border: "1px solid var(--line)",
                        overflow: "hidden",
                        transition: "transform 120ms ease, box-shadow 120ms ease",
                        transform: timerStatus === "idle" && isHovered ? "translateY(-1px)" : "none",
                        boxShadow:
                          timerStatus === "idle" && isHovered
                            ? "0 2px 8px rgba(0, 0, 0, 0.16)"
                            : "none"
                      }}
                      onMouseEnter={() => setHoveredTimerStepId(step.id)}
                      onMouseLeave={() => setHoveredTimerStepId((previous) => (previous === step.id ? null : previous))}
                    >
                      {timerStatus === "running" ? (
                        <div
                          style={{
                            display: "inline-flex",
                            width: isHovered ? 58 : 0,
                            opacity: isHovered ? 1 : 0,
                            overflow: "hidden",
                            transition: "width 140ms ease, opacity 120ms ease",
                            pointerEvents: isHovered ? "auto" : "none"
                          }}
                        >
                          <button
                            type="button"
                            aria-label={`Pause timer for ${step.instruction}`}
                            onClick={() => pauseTimer(step.id)}
                            style={{
                              width: 29,
                              height: 29,
                              border: 0,
                              borderRight: "1px solid var(--line)",
                              background: "transparent",
                              color: "inherit",
                              padding: 0,
                              display: "inline-flex",
                              alignItems: "center",
                              justifyContent: "center",
                              cursor: "pointer"
                            }}
                          >
                            <PauseIcon />
                          </button>
                          <button
                            type="button"
                            aria-label={`Cancel timer for ${step.instruction}`}
                            onClick={() => cancelTimer(step.id)}
                            style={{
                              width: 29,
                              height: 29,
                              border: 0,
                              borderRight: "1px solid var(--line)",
                              background: "transparent",
                              color: "inherit",
                              padding: 0,
                              display: "inline-flex",
                              alignItems: "center",
                              justifyContent: "center",
                              cursor: "pointer"
                            }}
                          >
                            <CancelIcon />
                          </button>
                        </div>
                      ) : null}
                      <button
                        type="button"
                        onClick={() => startTimer(step.id, step.timerSeconds!)}
                        style={{
                          border: 0,
                          background: "transparent",
                          color: "inherit",
                          padding: "4px 8px",
                          fontSize: "0.8rem",
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 6,
                          width: "auto",
                          cursor: "pointer"
                        }}
                      >
                        <TimerIcon />
                        {timerButtonLabel}
                      </button>
                    </div>
                  ) : null}
                </div>
                {step.detail ? <div className="muted">{step.detail}</div> : null}
              </li>
            );
          })}
        </ol>
      </article>

      {stickyTimers.top.length > 0 ? (
        <div
          style={{
            position: "fixed",
            top: 10,
            left: 10,
            right: 10,
            display: "grid",
            gap: 8,
            zIndex: 1200,
            pointerEvents: "none"
          }}
        >
          {stickyTimers.top.map((timer) => (
            <button
              key={`top-${timer.stepId}`}
              type="button"
              className="secondary"
              onClick={() => scrollToCookStep(timer.stepId)}
              style={{
                pointerEvents: "auto",
                justifySelf: "end",
                width: "auto",
                padding: "6px 10px",
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                fontSize: "0.82rem",
                boxShadow: "0 2px 8px rgba(0, 0, 0, 0.15)"
              }}
            >
              <TimerIcon />
              <strong>{timer.instruction}</strong>
              <span>{formatSeconds(timer.remaining)}</span>
            </button>
          ))}
        </div>
      ) : null}

      {stickyTimers.bottom.length > 0 ? (
        <div
          style={{
            position: "fixed",
            bottom: 10,
            left: 10,
            right: 10,
            display: "grid",
            gap: 8,
            zIndex: 1200,
            pointerEvents: "none"
          }}
        >
          {stickyTimers.bottom.map((timer) => (
            <button
              key={`bottom-${timer.stepId}`}
              type="button"
              className="secondary"
              onClick={() => scrollToCookStep(timer.stepId)}
              style={{
                pointerEvents: "auto",
                justifySelf: "end",
                width: "auto",
                padding: "6px 10px",
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                fontSize: "0.82rem",
                boxShadow: "0 2px 8px rgba(0, 0, 0, 0.15)"
              }}
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
