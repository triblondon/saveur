"use client";

import styles from "@/components/styles/step-timer.module.css";

export type TimerStatus = "idle" | "running" | "paused" | "done";

export interface StepTimerInfo {
  status: TimerStatus;
  remainingSeconds: number;
  durationSeconds: number;
}

interface StepTimerProps {
  instruction: string;
  timerInfo: StepTimerInfo;
  isHovered: boolean;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
  onStart: () => void;
  onPause: () => void;
  onCancel: () => void;
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

function timerButtonLabel(timerInfo: StepTimerInfo): string {
  if (timerInfo.status === "running") {
    return formatSeconds(timerInfo.remainingSeconds);
  }

  if (timerInfo.status === "paused") {
    return `Resume ${formatSeconds(timerInfo.remainingSeconds)}`;
  }

  return `${Math.round(timerInfo.durationSeconds / 60)} min`;
}

export function StepTimer(props: StepTimerProps) {
  const {
    instruction,
    timerInfo,
    isHovered,
    onMouseEnter,
    onMouseLeave,
    onStart,
    onPause,
    onCancel
  } = props;

  const running = timerInfo.status === "running";

  return (
    <div
      className={`${styles.timerShell} ${timerInfo.status === "idle" && isHovered ? styles.timerShellIdleHover : ""} ${running ? styles.timerShellRunning : ""} ${running && isHovered ? styles.timerShellRunningHover : ""}`}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      <div className={`${styles.timerControls} ${running && isHovered ? styles.timerControlsVisible : ""}`}>
        <button
          type="button"
          aria-label={`Pause timer for ${instruction}`}
          onClick={onPause}
          className={styles.timerControlButton}
        >
          <PauseIcon />
        </button>
        <button
          type="button"
          aria-label={`Cancel timer for ${instruction}`}
          onClick={onCancel}
          className={styles.timerControlButton}
        >
          <CancelIcon />
        </button>
      </div>
      <button type="button" onClick={onStart} className={styles.timerMainButton}>
        <TimerIcon />
        {timerButtonLabel(timerInfo)}
      </button>
    </div>
  );
}
