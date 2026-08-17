import { Table, TableBody, TableCell, TableHead, TableHeaderCell, TableRow } from "@tremor/react";

import { EmptyState } from "@/components/ui/EmptyState";
import { formatDateId } from "@/lib/formatters";

import styles from "./KnowledgeBaseList.module.css";

export interface KnowledgeDocEntry {
  readonly name: string;
  readonly itemCount: number;
  readonly uploadedAt: string;
}

/**
 * Active knowledge documents list (spec "knowledge/page.tsx" mockup: "SOP-Penjualan-v2.xlsx · 48
 * items · 01 Agu"). Restyled onto Tremor's `Table` (FINAL UI REBUILD coordinator note #6 —
 * reasonable extension of the same Leads/Analisa Tremor `Table` pattern already established) in
 * place of the plain `<ul>` this replaced; the `docs` prop and its shape are unchanged.
 */
export function KnowledgeBaseList({
  docs,
}: {
  readonly docs: readonly KnowledgeDocEntry[];
}): React.ReactElement {
  if (docs.length === 0) {
    return (
      <EmptyState
        icon="📚"
        title="Belum ada knowledge"
        description="Upload Excel untuk menambahkan."
      />
    );
  }
  return (
    <div data-testid="knowledge-base-list" className={styles.tableWrap}>
      <Table>
        <TableHead>
          <TableRow>
            <TableHeaderCell>Nama File</TableHeaderCell>
            <TableHeaderCell>Jumlah Data</TableHeaderCell>
            <TableHeaderCell>Diupload</TableHeaderCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {docs.map((doc) => (
            <TableRow key={doc.name}>
              <TableCell className={styles.name}>📄 {doc.name}</TableCell>
              <TableCell className={styles.meta}>{doc.itemCount} items</TableCell>
              <TableCell className={styles.meta}>{formatDateId(doc.uploadedAt)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
