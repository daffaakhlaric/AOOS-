import { EmptyState } from "@/components/ui/EmptyState";
import { formatDateId } from "@/lib/formatters";

export interface KnowledgeDocEntry {
  readonly name: string;
  readonly itemCount: number;
  readonly uploadedAt: string;
}

/** Active knowledge documents list (spec "knowledge/page.tsx" mockup: "SOP-Penjualan-v2.xlsx · 48 items · 01 Agu"). */
export function KnowledgeBaseList({
  docs,
}: {
  readonly docs: readonly KnowledgeDocEntry[];
}): React.ReactElement {
  if (docs.length === 0) {
    return <EmptyState title="Belum ada knowledge" description="Upload Excel untuk menambahkan." />;
  }
  return (
    <ul data-testid="knowledge-base-list" className="divide-y divide-hairline">
      {docs.map((doc) => (
        <li key={doc.name} className="flex items-center justify-between py-2 text-sm">
          <span className="text-ink">📄 {doc.name}</span>
          <span className="text-ink-muted">
            {doc.itemCount} items · {formatDateId(doc.uploadedAt)}
          </span>
        </li>
      ))}
    </ul>
  );
}
