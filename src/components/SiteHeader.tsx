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
    <svg width="28" height="28" viewBox="0 0 32 32" aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id="saveurLogoGradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#ffe38b" />
          <stop offset="100%" stopColor="#c9a146" />
        </linearGradient>
      </defs>
      <rect x="1.5" y="1.5" width="29" height="29" rx="9" fill="#15110b" stroke="#322517" />
      <path
        d="M21.7 9.1c-1.9-.7-4 .3-4.7 2.2l-.3.8c-.9-1.1-2.4-1.6-3.8-1.2-2 .6-3.1 2.7-2.5 4.7.6 2 2.7 3.1 4.7 2.5l3.2-1 4-2.9c1.5-1.1 2.1-3.1 1.4-4.9Z"
        fill="url(#saveurLogoGradient)"
      />
      <circle cx="12.1" cy="21.2" r="2.3" fill="#f5f2e7" />
      <circle cx="20.2" cy="20.4" r="1.8" fill="#f0dca7" />
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
