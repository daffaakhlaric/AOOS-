import { TopBar } from "@/components/layout/TopBar";
import { ListingDetailClient } from "@/components/listings/ListingDetailClient";

/** `/listings/:id` — Listing Detail page (spec Part 4). */
export default function ListingDetailPage({
  params,
}: {
  readonly params: { readonly id: string };
}): React.ReactElement {
  return (
    <main>
      <TopBar title="Detail Listing" />
      <ListingDetailClient listingId={params.id} />
    </main>
  );
}
