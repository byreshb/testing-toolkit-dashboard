"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { NAV_LINKS } from "./nav-links";
import styles from "./NavBar.module.css";

/**
 * The page navigation and, when more than one repository is configured, a switcher for it.
 * Client-side so it can read and preserve the current `?repo=` search param across page
 * navigation; the pages themselves read that param server-side to select the active repo.
 */
export function NavBar({ repos }: { repos: readonly string[] }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const defaultRepo = repos[0];
  const activeRepo = searchParams.get("repo") ?? defaultRepo;
  const repoSuffix =
    activeRepo === undefined || activeRepo === defaultRepo
      ? ""
      : `?repo=${encodeURIComponent(activeRepo)}`;

  return (
    <>
      <nav className={styles.nav} aria-label="Main">
        {NAV_LINKS.map((item) => (
          <Link
            key={item.href}
            href={`${item.href}${repoSuffix}`}
            aria-current={pathname === item.href ? "page" : undefined}
          >
            {item.label}
          </Link>
        ))}
      </nav>
      {repos.length > 1 && (
        <nav className={styles.repos} aria-label="Repository" data-testid="repo-switcher">
          {repos.map((name) => {
            const params = new URLSearchParams(searchParams.toString());
            if (name === defaultRepo) {
              params.delete("repo");
            } else {
              params.set("repo", name);
            }
            const query = params.toString();
            const isActive = name === activeRepo;
            return (
              <Link
                key={name}
                href={query === "" ? pathname : `${pathname}?${query}`}
                aria-current={isActive ? "page" : undefined}
                data-testid="repo-option"
              >
                {name}
              </Link>
            );
          })}
        </nav>
      )}
    </>
  );
}
