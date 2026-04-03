import type { Metadata } from "next";
import { Oswald } from "next/font/google";
import "./globals.css";
import styles from "@/app/styles/layout.module.css";
import { SiteHeader } from "@/components/SiteHeader";
import { getCurrentUser } from "@/lib/auth/current-user";

export const metadata: Metadata = {
  title: "Saveur",
  description: "Save and cook recipes without noise"
};

const headingFont = Oswald({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  variable: "--font-heading"
});

export default async function RootLayout({
  children
}: Readonly<{ children: React.ReactNode }>) {
  const user = await getCurrentUser();

  return (
    <html lang="en">
      <body className={headingFont.variable}>
        {user ? <SiteHeader user={user} /> : null}
        <main className={styles.pageMain}>
          {children}
        </main>
      </body>
    </html>
  );
}
