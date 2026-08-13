import { TopBar } from "@/components/layout/TopBar";
import { KnowledgeClient } from "@/components/knowledge/KnowledgeClient";

/** Excel upload + knowledge base (spec "knowledge/page.tsx"). */
export default function KnowledgePage(): React.ReactElement {
  return (
    <main>
      <TopBar title="Knowledge Base" />
      <KnowledgeClient />
    </main>
  );
}
