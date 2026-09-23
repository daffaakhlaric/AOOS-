import { Suspense } from "react";
import { ListingsPage } from "@/components/listings/ListingsPage";
export default function Page() {
  return (
    <Suspense fallback={<p>Memuat listing…</p>}>
      <ListingsPage />
    </Suspense>
  );
}
