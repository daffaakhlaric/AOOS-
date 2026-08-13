import { Suspense } from "react";

import { ClosingForm } from "@/components/closing/ClosingForm";

/** Input closing/SPK form (spec "closing/new/page.tsx"). `ClosingForm` uses `useSearchParams` (to read `?leadId=`), which requires a `Suspense` boundary. */
export default function NewClosingPage(): React.ReactElement {
  return (
    <main>
      <Suspense>
        <ClosingForm />
      </Suspense>
    </main>
  );
}
