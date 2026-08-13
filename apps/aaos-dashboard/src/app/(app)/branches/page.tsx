import { BranchesClient } from "@/components/branches/BranchesClient";
import { TopBar } from "@/components/layout/TopBar";

/** Branch settings + sales team (spec "branches/page.tsx"). */
export default function BranchesPage(): React.ReactElement {
  return (
    <main>
      <TopBar title="Branch Settings" />
      <BranchesClient />
    </main>
  );
}
