import Link from "next/link";
import { NAV_LINKS } from "./nav-links";
import styles from "./NavBar.module.css";

/**
 * Server-rendered stand-in for NavBar shown while its `useSearchParams()` client boundary
 * resolves (and for statically generated routes, such as 404, that never hydrate it with a
 * request). No repo suffix or active-link state, since those need the request's URL.
 */
export function NavBarFallback() {
  return (
    <nav className={styles.nav} aria-label="Main">
      {NAV_LINKS.map((item) => (
        <Link key={item.href} href={item.href}>
          {item.label}
        </Link>
      ))}
    </nav>
  );
}
