"use client";

import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import styles from "@/components/styles/header-wakelock.module.css";

type WakeLockState = "unsupported" | "enabled" | "disabled";

function isCookModePath(pathname: string): boolean {
  const segments = pathname.split("/").filter(Boolean);
  return segments.length === 2 && segments[0] === "recipes";
}

function WakeLockIcon(props: { state: WakeLockState }) {
  const { state } = props;
  const color = state === "enabled" ? "#0d8a6d" : state === "disabled" ? "#b42318" : "#6b7280";

  return (
    <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path
        fill={color}
        d="M6 2h9l5 5v13a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2m7 7V3.5L18.5 9M8 12v2h8v-2m-8 4v2h6v-2"
      />
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

  const title = useMemo(() => {
    if (!cookMode) {
      return "Wake lock inactive";
    }

    if (wakeLockState === "enabled") {
      return "Wake lock enabled";
    }
    if (wakeLockState === "unsupported") {
      return "Wake lock unsupported";
    }
    return "Wake lock disabled";
  }, [cookMode, wakeLockState]);

  return (
    <span className={styles.badge} title={title} aria-label={title}>
      <WakeLockIcon state={wakeLockState} />
    </span>
  );
}

