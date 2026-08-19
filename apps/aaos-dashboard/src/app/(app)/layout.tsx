import { Sidebar } from "@/components/layout/Sidebar";
import { MobileNav } from "@/components/layout/MobileNav";

import styles from "./layout.module.css";

/**
 * Layout for every authenticated route (`/dashboard`, `/meta-ads`, `/objective`, `/creative`,
 * `/branches`, `/go-live`, `/jessy/*`) — adds the desktop `Sidebar` and mobile bottom nav around
 * the page content. Deliberately excludes `(auth)/login`, a sibling route group: the login page
 * should render as a bare centered form with no app chrome.
 *
 * TOTAL UI REBUILD spec "=== LAYOUT ===": CSS Grid (`220px 1fr`) replaces the prior Tailwind
 * `flex` wrapper — see `layout.module.css`.
 */
export default function AppLayout({
  children,
}: {
  readonly children: React.ReactNode;
}): React.ReactElement {
  return (
    <>
      <div className={styles.shell}>
        <Sidebar />
        <div className={styles.main}>{children}</div>
      </div>
      <MobileNav />
    </>
  );
}
