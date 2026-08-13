import { CreativeClient } from "@/components/creative/CreativeClient";
import { TopBar } from "@/components/layout/TopBar";

/** Creative packages pending approval (spec "creative/page.tsx"). */
export default function CreativePage(): React.ReactElement {
  return (
    <main>
      <TopBar title="Creative Review" />
      <CreativeClient />
    </main>
  );
}
