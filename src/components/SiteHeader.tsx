"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { mdiAccountCircleOutline } from "@mdi/js";
import { HeaderWakeLockIndicator } from "@/components/HeaderWakeLockIndicator";
import { AppLogo } from "@/components/AppLogo";
import styles from "@/app/styles/layout.module.css";

interface SiteHeaderProps {
  user: {
    id: string;
    name: string;
    email: string;
  };
}

const PRIMARY_LINKS = [
  { href: "/collections", label: "Collections" },
  { href: "/recipes", label: "Recipes" }
] as const;

const MENU_LINKS = [
  { href: "/collections", label: "Collections" },
  { href: "/recipes", label: "Recipes" },
  { href: "/import", label: "Import recipe" },
  { href: "/new", label: "New recipe" }
] as const;

function UserIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path fill="currentColor" d={mdiAccountCircleOutline} />
    </svg>
  );
}

function initials(name: string): string {
  const parts = name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
  return parts || "?";
}

export function SiteHeader({ user }: SiteHeaderProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!menuOpen) {
      return;
    }

    function onPointerDown(event: PointerEvent) {
      if (!menuRef.current?.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    }

    document.addEventListener("pointerdown", onPointerDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
    };
  }, [menuOpen]);

  const userInitials = useMemo(() => initials(user.name), [user.name]);

  async function onSignOut() {
    setSigningOut(true);
    try {
      await fetch("/api/auth/logout", {
        method: "POST"
      });
      router.push("/auth");
      router.refresh();
    } finally {
      setSigningOut(false);
    }
  }

  return (
    <header className={styles.siteHeader}>
      <div className={styles.headerInner}>
        <div className={styles.topRow}>
          <h1 className={styles.brand}>
            <Link href="/" className={styles.brandLink}>
              <AppLogo iconSize={26} />
            </Link>
          </h1>

          <nav className={styles.desktopPrimaryNav}>
            {PRIMARY_LINKS.map((item) => (
              <Link key={item.href} className={styles.navLink} href={item.href}>
                {item.label}
              </Link>
            ))}
          </nav>

          <div className={styles.headerRight}>
            <HeaderWakeLockIndicator />
            <div className={styles.userMenuWrap} ref={menuRef}>
              <button
                type="button"
                className={styles.userBadgeButton}
                aria-expanded={menuOpen}
                aria-haspopup="menu"
                onClick={() => setMenuOpen((previous) => !previous)}
              >
                <span className={styles.userBadgeIcon}>
                  <UserIcon />
                </span>
                <span className={styles.userBadgeInitials}>{userInitials}</span>
              </button>

              {menuOpen ? (
                <div className={styles.userMenuPanel} role="menu">
                  {MENU_LINKS.map((item) => (
                    <Link key={item.href} className={styles.userMenuLink} href={item.href} role="menuitem">
                      {item.label}
                    </Link>
                  ))}
                  <button
                    type="button"
                    className={`secondary ${styles.userMenuButton}`}
                    role="menuitem"
                    onClick={() => void onSignOut()}
                    disabled={signingOut}
                  >
                    {signingOut ? "Signing out..." : "Log out"}
                  </button>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
