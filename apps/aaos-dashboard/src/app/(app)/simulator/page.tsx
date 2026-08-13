import { TopBar } from "@/components/layout/TopBar";

/** Link/embed to `apps/aaos-simulator` (spec "simulator/page.tsx") — a separate deployed Next.js app, not composed into this one; `NEXT_PUBLIC_SIMULATOR_URL` points at wherever it's deployed, defaulting to the conventional local dev port. */
export default function SimulatorPage(): React.ReactElement {
  const simulatorUrl = process.env.NEXT_PUBLIC_SIMULATOR_URL ?? "http://localhost:3001/simulator";
  return (
    <main>
      <TopBar title="Simulator" />
      <div className="p-6">
        <p className="text-sm text-ink-muted">
          Jessy Simulator berjalan sebagai aplikasi terpisah (apps/aaos-simulator).
        </p>
        <a
          href={simulatorUrl}
          target="_blank"
          rel="noreferrer"
          className="mt-3 inline-block rounded-button bg-brand-primary px-4 py-2 text-sm font-semibold text-white"
        >
          Buka Simulator →
        </a>
      </div>
    </main>
  );
}
