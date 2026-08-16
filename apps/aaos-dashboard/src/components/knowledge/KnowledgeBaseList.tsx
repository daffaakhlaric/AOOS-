import { EmptyState } from "@/components/ui/EmptyState";
import { formatDateId } from "@/lib/formatters";

import styles from "./KnowledgeBaseList.module.css";

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
    <ul data-testid="knowledge-base-list" className={styles.list}>
      {docs.map((doc) => (
        <li key={doc.name} className={styles.row}>
          <span className={styles.name}>📄 {doc.name}</span>
          <span className={styles.meta}>
            {doc.itemCount} items · {formatDateId(doc.uploadedAt)}
          </span>
        </li>
      ))}
    </ul>
  );
}
