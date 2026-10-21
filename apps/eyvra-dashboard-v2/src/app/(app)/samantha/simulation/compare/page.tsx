import { Suspense } from "react";
import { CompareSimulationRunsPage } from "@/components/stress-test/compare/CompareSimulationRunsPage";
export default function Page() {
  return (
    <Suspense fallback={<p>Memuat perbandingan…</p>}>
      <CompareSimulationRunsPage />
    </Suspense>
  );
}
