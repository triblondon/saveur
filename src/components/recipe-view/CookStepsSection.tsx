"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import { StepTimer, type StepTimerInfo } from "@/components/StepTimer";
import type { Recipe } from "@/lib/types";
import styles from "@/components/styles/recipe-view.module.css";

interface CookStepsSectionProps {
  cookSteps: Recipe["cookSteps"];
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

interface OffscreenPosition {
  bucket: "top" | "bottom";
  rank: number;
}

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

function shallowEqualPositions(
  left: Record<string, OffscreenPosition>,
  right: Record<string, OffscreenPosition>
): boolean {
  const leftKeys = Object.keys(left);
  const rightKeys = Object.keys(right);
  if (leftKeys.length !== rightKeys.length) {
    return false;
  }

  for (const key of leftKeys) {
    const leftValue = left[key];
    const rightValue = right[key];
    if (!rightValue || leftValue.bucket !== rightValue.bucket || leftValue.rank !== rightValue.rank) {
      return false;
    }
  }

  return true;
}

export function CookStepsSection({ cookSteps }: CookStepsSectionProps) {
  const [timerStates, setTimerStates] = useState<Record<string, StepTimerState>>({});
  const [now, setNow] = useState<number>(() => Date.now());
  const [hoveredTimerStepId, setHoveredTimerStepId] = useState<string | null>(null);
  const [offscreenByStep, setOffscreenByStep] = useState<Record<string, OffscreenPosition>>({});
  const cookStepRefs = useRef<Record<string, HTMLLIElement | null>>({});

  const timerInfoByStep = useMemo(() => {
    const infoByStep: Record<string, StepTimerInfo> = {};

    for (const [index, step] of cookSteps.entries()) {
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
  }, [cookSteps, timerStates, now]);

  const runningStepIds = useMemo(
    () =>
      Object.entries(timerInfoByStep)
        .filter(([, timerInfo]) => timerInfo.status === "running")
        .map(([stepId]) => stepId),
    [timerInfoByStep]
  );

  useEffect(() => {
    if (runningStepIds.length === 0) {
      return;
    }

    const interval = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(interval);
  }, [runningStepIds.length]);

  const recomputeOffscreen = useCallback(() => {
    if (typeof window === "undefined") {
      return;
    }

    const viewportHeight = window.innerHeight;
    const next: Record<string, OffscreenPosition> = {};

    for (const stepId of runningStepIds) {
      const element = cookStepRefs.current[stepId];
      if (!element) {
        continue;
      }

      const rect = element.getBoundingClientRect();
      if (rect.bottom < 0) {
        next[stepId] = {
          bucket: "top",
          rank: rect.bottom
        };
      } else if (rect.top > viewportHeight) {
        next[stepId] = {
          bucket: "bottom",
          rank: rect.top
        };
      }
    }

    setOffscreenByStep((previous) => (shallowEqualPositions(previous, next) ? previous : next));
  }, [runningStepIds]);

  useEffect(() => {
    if (runningStepIds.length === 0) {
      setOffscreenByStep({});
      return;
    }

    let frameId: number | null = null;
    const requestRecompute = () => {
      if (frameId !== null) {
        return;
      }

      frameId = window.requestAnimationFrame(() => {
        frameId = null;
        recomputeOffscreen();
      });
    };

    window.addEventListener("scroll", requestRecompute, { passive: true });
    window.addEventListener("resize", requestRecompute);
    requestRecompute();

    return () => {
      window.removeEventListener("scroll", requestRecompute);
      window.removeEventListener("resize", requestRecompute);
      if (frameId !== null) {
        window.cancelAnimationFrame(frameId);
      }
    };
  }, [recomputeOffscreen, runningStepIds.length]);

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

  const stickyTimers = useMemo(() => {
    const top: StickyTimer[] = [];
    const bottom: StickyTimer[] = [];

    for (const [stepId, position] of Object.entries(offscreenByStep)) {
      const index = Number(stepId);
      const step = cookSteps[index];
      const timerInfo = timerInfoByStep[stepId];

      if (!step || !timerInfo || timerInfo.status !== "running") {
        continue;
      }

      const target = position.bucket === "top" ? top : bottom;
      target.push({
        stepId,
        instruction: step.instruction,
        remaining: timerInfo.remainingSeconds,
        rank: position.rank
      });
    }

    top.sort((a, b) => b.rank - a.rank);
    bottom.sort((a, b) => a.rank - b.rank);

    return { top, bottom };
  }, [cookSteps, offscreenByStep, timerInfoByStep]);

  return (
    <>
      <article className="card">
        <h3 className={styles.cookTitle}>Cook steps</h3>
        <ol className={styles.cookList}>
          {cookSteps.map((step, index) => {
            const stepKey = String(index);
            const timerInfo =
              step.timerSeconds && step.timerSeconds > 0
                ? (timerInfoByStep[stepKey] ?? {
                    status: "idle",
                    remainingSeconds: step.timerSeconds,
                    durationSeconds: step.timerSeconds
                  })
                : null;
            const isHovered = hoveredTimerStepId === stepKey;

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
                  {timerInfo ? (
                    <StepTimer
                      instruction={step.instruction}
                      timerInfo={timerInfo}
                      isHovered={isHovered}
                      onMouseEnter={() => setHoveredTimerStepId(stepKey)}
                      onMouseLeave={() =>
                        setHoveredTimerStepId((previous) => (previous === stepKey ? null : previous))
                      }
                      onStart={() => startTimer(stepKey, step.timerSeconds!)}
                      onPause={() => pauseTimer(stepKey)}
                      onCancel={() => cancelTimer(stepKey)}
                    />
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
    </>
  );
}

