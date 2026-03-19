"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { mdiCellphoneLock } from "@mdi/js";
import styles from "@/components/styles/header-wakelock.module.css";

type WakeLockState = "unsupported" | "enabled" | "disabled";

function isCookModePath(pathname: string): boolean {
  const segments = pathname.split("/").filter(Boolean);
  return segments.length === 2 && segments[0] === "recipes";
}

function WakeLockIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path fill="currentColor" d={mdiCellphoneLock} />
    </svg>
  );
}

export function HeaderWakeLockIndicator() {
  const pathname = usePathname();
  const cookMode = isCookModePath(pathname);
  const [wakeLockState, setWakeLockState] = useState<WakeLockState>("disabled");

  useEffect(() => {
    let released = false;
    let lock: WakeLockSentinel | null = null;

    if (!cookMode) {
      setWakeLockState("disabled");
      return;
    }

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
  }, [cookMode]);

  if (!cookMode || wakeLockState !== "enabled") {
    return null;
  }

  return (
    <span className={styles.badge} title="Wake lock enabled" aria-label="Wake lock enabled">
      <WakeLockIcon />
    </span>
  );
}
