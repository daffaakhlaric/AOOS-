import { CreativeDetailClient } from "@/components/creative/CreativeDetailClient";
import { TopBar } from "@/components/layout/TopBar";

/** Creative detail page (spec "creative/[packageId]/page.tsx"). */
export default function CreativeDetailPage({
  params,
}: {
  readonly params: { readonly packageId: string };
}): React.ReactElement {
  return (
    <main>
      <TopBar title="Detail Creative" />
      <CreativeDetailClient packageId={params.packageId} />
    </main>
  );
}
