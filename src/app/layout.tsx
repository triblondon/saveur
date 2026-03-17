import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";
import styles from "@/app/styles/layout.module.css";
import { HeaderWakeLockIndicator } from "@/components/HeaderWakeLockIndicator";

export const metadata: Metadata = {
  title: "Saveur",
  description: "Save and cook recipes without noise"
};

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
                <h1 className={styles.brand}>Saveur</h1>
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
                Gousto-first recipe import and clean mobile cooking view.
              </p>
            </header>
            {children}
          </div>
        </main>
      </body>
    </html>
  );
}
