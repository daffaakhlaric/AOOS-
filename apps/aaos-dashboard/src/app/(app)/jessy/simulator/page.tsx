import { TopBar } from "@/components/layout/TopBar";

import styles from "./page.module.css";

/** Link/embed to `apps/aaos-simulator` (spec "simulator/page.tsx") — a separate deployed Next.js app, not composed into this one; `NEXT_PUBLIC_SIMULATOR_URL` points at wherever it's deployed, defaulting to the conventional local dev port. */
export default function SimulatorPage(): React.ReactElement {
  const simulatorUrl = process.env.NEXT_PUBLIC_SIMULATOR_URL ?? "http://localhost:3001/simulator";
  return (
    <main>
      <TopBar title="Simulator" />
      <div className={styles.page}>
        <p className={styles.text}>
          Jessy Simulator berjalan sebagai aplikasi terpisah (apps/aaos-simulator).
        </p>
        <a href={simulatorUrl} target="_blank" rel="noreferrer" className={styles.link}>
          Buka Simulator →
        </a>
      </div>
    </main>
  );
}
