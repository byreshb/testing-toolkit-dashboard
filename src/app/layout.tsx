import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import "./globals.css";
import styles from "./layout.module.css";

export const metadata: Metadata = {
  title: "Testing toolkit dashboard",
  description: "Test health over time: flaky tests, test quality findings and LLM evaluation drift",
};

const NAV = [
  { href: "/", label: "Overview" },
  { href: "/flaky", label: "Flaky tests" },
  { href: "/quality", label: "Test quality" },
  { href: "/evals", label: "LLM evals" },
];

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <header className={styles.header}>
          <Link href="/" className={styles.brand}>
            Testing toolkit dashboard
          </Link>
          <nav className={styles.nav} aria-label="Main">
            {NAV.map((item) => (
              <Link key={item.href} href={item.href}>
                {item.label}
              </Link>
            ))}
          </nav>
        </header>
        <main className={styles.main}>{children}</main>
      </body>
    </html>
  );
}
