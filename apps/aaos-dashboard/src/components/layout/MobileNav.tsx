"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { NAV_ITEMS } from "./Sidebar";
import styles from "./MobileNav.module.css";

/** Bottom tab bar for mobile viewports (spec "Mobile responsive (stacked layout)") — visible below `md`, where `Sidebar` is hidden. Shows the first 5 nav items to keep the bar from overflowing small screens. */
export function MobileNav(): React.ReactElement {
  const pathname = usePathname();
  const items = NAV_ITEMS.slice(0, 5);
  return (
    <nav aria-label="Navigasi mobile" className={styles.nav}>
      {items.map((item) => {
        const active = pathname === item.href || pathname?.startsWith(`${item.href}/`);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`${styles.link} ${active ? styles.linkActive : ""}`}
            aria-current={active ? "page" : undefined}
          >
            <span aria-hidden="true">{item.icon}</span>
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
