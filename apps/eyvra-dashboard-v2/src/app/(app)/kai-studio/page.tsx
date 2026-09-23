import { Suspense } from "react";
import { KaiStudio } from "@/components/kai/KaiStudio";
export default function Page() {
  return (
    <Suspense fallback={<p>Loading Kai Studio…</p>}>
      <KaiStudio />
    </Suspense>
  );
}
