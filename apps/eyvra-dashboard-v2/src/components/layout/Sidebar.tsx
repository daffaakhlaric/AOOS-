"use client";
import { Fragment, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { MAIN_NAV, SETTINGS_ITEM, type NavItem } from "./navItems";
import { NavIcon } from "./NavIcon";
import styles from "./Sidebar.module.css";
import { BrandLogo, BrandMark } from "@/components/brand/BrandLogo";

export function Sidebar(): React.ReactElement {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  function itemLink(item: NavItem): React.ReactElement {
    const content = (
      <>
        <NavIcon name={item.icon} />
        {!collapsed ? <span className={styles.navLabel}>{item.label}</span> : null}
      </>
    );
    return (
      <Link
        key={item.key}
        href={item.href}
        title={item.label}
        aria-current={
          pathname === item.href || pathname.startsWith(item.href + "/") ? "page" : undefined
        }
        className={`${styles.navItem} ${pathname === item.href || pathname.startsWith(item.href + "/") ? styles.navItemActive : ""}`}
      >
        {content}
      </Link>
    );
  }
  return (
    <nav
      aria-label="Navigasi utama"
      className={`${styles.sidebar} ${collapsed ? styles.sidebarCollapsed : ""}`}
    >
      <div className={styles.top}>
        <Link href="/command-center" aria-label="SkorPintar Ads Insight — Command Center">
          {collapsed ? <BrandMark /> : <BrandLogo />}
        </Link>
        <button
          type="button"
          className={styles.collapseButton}
          onClick={() => setCollapsed(!collapsed)}
          aria-label={collapsed ? "Perluas sidebar" : "Ciutkan sidebar"}
        >
          <NavIcon name="menu" size={14} />
        </button>
      </div>
      <div className={styles.nav}>
        {MAIN_NAV.map((item) => (
          <Fragment key={item.key}>
            {itemLink(item)}
            {item.key === "automation" && !collapsed && pathname.startsWith("/automation") && (
              <Link
                className={styles.navItem}
                href="/automation/growth-settings"
                aria-current={pathname === "/automation/growth-settings" ? "page" : undefined}
              >
                　Growth Settings
              </Link>
            )}
          </Fragment>
        ))}
        {!collapsed && pathname.startsWith("/samantha/") && (
          <Link
            href="/samantha/simulation/compare"
            aria-current={pathname === "/samantha/simulation/compare" ? "page" : undefined}
            className={`${styles.navItem} ${pathname === "/samantha/simulation/compare" ? styles.navItemActive : ""}`}
          >
            Compare Runs
          </Link>
        )}
      </div>
      <div className={styles.settingsRow}>
        <div className={styles.divider} />
        {itemLink(SETTINGS_ITEM)}
      </div>
      {!collapsed ? (
        <aside className={styles.team}>
          <p>AI yang mengubah data menjadi pertumbuhan.</p>
          {[
            ["Samantha", "Advertising operations"],
            ["Kai", "Creative production"],
            ["Clara", "Sales intelligence"],
          ].map(([name, role]) => (
            <div key={name}>
              <span className={styles.orb}>✧</span>
              <span>
                <strong>{name}</strong>
                {role}
              </span>
            </div>
          ))}
          <Link href="/samantha">Buka Samantha →</Link>
          <Link href="/listings">Kelola Listings →</Link>
        </aside>
      ) : null}
    </nav>
  );
}
