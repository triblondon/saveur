import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

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
          <header style={{ marginBottom: 20 }}>
            <h1 style={{ marginBottom: 8 }}>Saveur</h1>
            <nav className="row" style={{ marginBottom: 8 }}>
              <Link href="/">Home</Link>
              <Link href="/import">Import URL</Link>
              <Link href="/new">New Recipe</Link>
            </nav>
            <p className="muted" style={{ marginTop: 0 }}>
              Gousto-first recipe import and clean mobile cooking view.
            </p>
          </header>
          {children}
        </main>
      </body>
    </html>
  );
}
