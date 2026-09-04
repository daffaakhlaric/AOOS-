import { TopBar } from "@/components/layout/TopBar";
import { ObjectiveClient } from "@/components/objective/ObjectiveClient";

/** Set + track monthly objective (spec "objective/page.tsx"). */
export default function ObjectivePage(): React.ReactElement {
  return (
    <main>
      <TopBar title="Objective" />
      <ObjectiveClient />
    </main>
  );
}
