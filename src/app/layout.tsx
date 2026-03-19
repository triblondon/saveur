import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";
import styles from "@/app/styles/layout.module.css";
import { HeaderWakeLockIndicator } from "@/components/HeaderWakeLockIndicator";

export const metadata: Metadata = {
  title: "Saveur",
  description: "Save and cook recipes without noise"
};

function BrandLogo() {
  return (
    <svg width="28" height="28" viewBox="0 0 32 32" aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id="saveurLogoGradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#5eead4" />
          <stop offset="100%" stopColor="#10b981" />
        </linearGradient>
      </defs>
      <rect x="1.5" y="1.5" width="29" height="29" rx="9" fill="#0f172a" stroke="#1f2937" />
      <path
        d="M21.7 9.1c-1.9-.7-4 .3-4.7 2.2l-.3.8c-.9-1.1-2.4-1.6-3.8-1.2-2 .6-3.1 2.7-2.5 4.7.6 2 2.7 3.1 4.7 2.5l3.2-1 4-2.9c1.5-1.1 2.1-3.1 1.4-4.9Z"
        fill="url(#saveurLogoGradient)"
      />
      <circle cx="12.1" cy="21.2" r="2.3" fill="#93c5fd" />
      <circle cx="20.2" cy="20.4" r="1.8" fill="#e2e8f0" />
    </svg>
  );
}

export default function RootLayout({
  children
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <main>
          <div className={styles.shell}>
            <header className={styles.header}>
              <div className={styles.topRow}>
                <h1 className={styles.brand}>
                  <Link href="/" className={styles.brandLink}>
                    <span className={styles.brandLogo}>
                      <BrandLogo />
                    </span>
                    <span>Saveur</span>
                  </Link>
                </h1>
                <HeaderWakeLockIndicator />
              </div>
              <nav className={styles.nav}>
                <Link className={styles.navLink} href="/">
                  Home
                </Link>
                <Link className={styles.navLink} href="/import">
                  Import URL
                </Link>
                <Link className={styles.navLink} href="/new">
                  New recipe
                </Link>
              </nav>
              <p className={`muted ${styles.subtitle}`}>
                Recipe import and mobile cooking view.
              </p>
            </header>
            {children}
          </div>
        </main>
      </body>
    </html>
  );
}
