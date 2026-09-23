import { Suspense } from "react";
import { KaiStudio } from "@/components/kai/KaiStudio";
export default function Page({ params }: { params: { briefId: string } }) {
  return (
    <Suspense fallback={<p>Loading Kai Studio…</p>}>
      <KaiStudio briefId={params.briefId} />
    </Suspense>
  );
}
