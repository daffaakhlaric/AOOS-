import { Suspense } from "react";
import { StressTestBuilder } from "@/components/stress-test/StressTestBuilder";

export default function Page(): React.ReactElement {
  return (
    <Suspense fallback={<p>Menyiapkan Creative Stress Test…</p>}>
      <StressTestBuilder />
    </Suspense>
  );
}
