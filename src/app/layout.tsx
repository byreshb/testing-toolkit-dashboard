import type { Metadata } from "next";
import Link from "next/link";
import { Suspense, type ReactNode } from "react";
import { NavBar } from "@/components/NavBar";
import { NavBarFallback } from "@/components/NavBarFallback";
import { resolveRepos } from "@/data/config";
import "./globals.css";
import styles from "./layout.module.css";

export const metadata: Metadata = {
  title: "Testing toolkit dashboard",
  description: "Test health over time: flaky tests, test quality findings and LLM evaluation drift",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  const repos = resolveRepos().map((r) => r.name);
  return (
    <html lang="en">
      <body>
        <header className={styles.header}>
          <Link href="/" className={styles.brand}>
            Testing toolkit dashboard
          </Link>
          <Suspense fallback={<NavBarFallback />}>
            <NavBar repos={repos} />
          </Suspense>
        </header>
        <main className={styles.main}>{children}</main>
      </body>
    </html>
  );
}
