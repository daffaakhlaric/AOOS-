import { BranchDetailClient } from "@/components/branches/BranchDetailClient";
import { TopBar } from "@/components/layout/TopBar";

/** Branch detail page (spec "branches/[branchId]/page.tsx"). */
export default function BranchDetailPage({
  params,
}: {
  readonly params: { readonly branchId: string };
}): React.ReactElement {
  return (
    <main>
      <TopBar title="Detail Branch" />
      <BranchDetailClient branchId={params.branchId} />
    </main>
  );
}
