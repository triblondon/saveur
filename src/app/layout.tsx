import type { Metadata } from "next";
import { Oswald } from "next/font/google";
import "./globals.css";
import styles from "@/app/styles/layout.module.css";
import { SiteHeader } from "@/components/SiteHeader";

export const metadata: Metadata = {
  title: "Saveur",
  description: "Save and cook recipes without noise"
};

const headingFont = Oswald({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  variable: "--font-heading"
});

export default function RootLayout({
  children
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className={headingFont.variable}>
        <SiteHeader />
        <main className={styles.pageMain}>
          {children}
        </main>
      </body>
    </html>
  );
}
