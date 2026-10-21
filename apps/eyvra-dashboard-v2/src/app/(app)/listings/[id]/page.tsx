import { Suspense } from "react";
import { ListingDetailPage } from "@/components/listing-detail/ListingDetailPage";
export default function Page({ params }: { params: { id: string } }) {
  return (
    <Suspense fallback={<p>Memuat listing…</p>}>
      <ListingDetailPage listingId={params.id} />
    </Suspense>
  );
}
