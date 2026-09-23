import { MobileNav } from "./MobileNav";
import { Sidebar } from "./Sidebar";
import styles from "./AppShell.module.css";

export function AppShell({ children }: { readonly children: React.ReactNode }): React.ReactElement {
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
