"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { MOBILE_NAV_ITEMS } from "./navItems";
import { NavIcon } from "./NavIcon";
import styles from "./MobileNav.module.css";

export function MobileNav(): React.ReactElement {
  const pathname = usePathname();
  const items = MOBILE_NAV_ITEMS;
  return (
    <nav aria-label="Navigasi mobile" className={styles.nav}>
      {items.map((item) => {
        const active = pathname === item.href || (pathname?.startsWith(`${item.href}/`) ?? false);
        if (item.comingSoon) {
          return (
            <span key={item.href} className={`${styles.link} ${styles.linkDisabled}`}>
              <NavIcon name={item.icon} size={18} />
              {item.label}
            </span>
          );
        }
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`${styles.link} ${active ? styles.linkActive : ""}`}
            aria-current={active ? "page" : undefined}
          >
            <NavIcon name={item.icon} size={18} />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
