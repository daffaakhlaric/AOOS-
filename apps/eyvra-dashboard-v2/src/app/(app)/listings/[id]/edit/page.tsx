import { ListingEditor } from "@/components/listings/ListingEditor";
export default function Page({ params }: { params: { id: string } }) {
  return <ListingEditor listingId={params.id} />;
}
