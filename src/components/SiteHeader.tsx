"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { mdiClose, mdiMenu } from "@mdi/js";
import { HeaderWakeLockIndicator } from "@/components/HeaderWakeLockIndicator";
import styles from "@/app/styles/layout.module.css";

const NAV_LINKS = [
  { href: "/", label: "Home" },
  { href: "/import", label: "Import URL" },
  { href: "/new", label: "New recipe" }
] as const;

function BrandLogo() {
  return (
    <svg width="26" height="26" viewBox="0 0 36 36" aria-hidden="true" focusable="false">
      <path
        d="M13 3c5 2 8 8 6 13s-7 8-10 11-4 7-2 10c-4-3-6-8-4-12 2-5 7-8 10-11 2-2 4-6 0-11Z"
        fill="currentColor"
      />
      <path
        d="M24 10c4 2 6 6 5 10-2 4-5 6-8 8-3 2-4 6-2 9-3-2-4-6-3-9 1-4 5-6 8-8 2-2 3-6 0-10Z"
        fill="currentColor"
      />
    </svg>
  );
}

function MenuIcon(props: { open: boolean }) {
  const { open } = props;
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path fill="currentColor" d={open ? mdiClose : mdiMenu} />
    </svg>
  );
}

export function SiteHeader() {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  return (
    <header className={styles.siteHeader}>
      <div className={styles.headerInner}>
        <div className={styles.topRow}>
          <h1 className={styles.brand}>
            <Link href="/" className={styles.brandLink}>
              <span className={styles.brandLogo}>
                <BrandLogo />
              </span>
              <span>Saveur</span>
            </Link>
          </h1>

          <div className={styles.headerRight}>
            <HeaderWakeLockIndicator />
            <button
              type="button"
              className={styles.menuButton}
              aria-label="Toggle navigation menu"
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen((previous) => !previous)}
            >
              <MenuIcon open={menuOpen} />
            </button>
          </div>
        </div>

        <nav className={`${styles.nav} ${menuOpen ? styles.navOpen : ""}`}>
          {NAV_LINKS.map((item) => (
            <Link key={item.href} className={styles.navLink} href={item.href}>
              {item.label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}
