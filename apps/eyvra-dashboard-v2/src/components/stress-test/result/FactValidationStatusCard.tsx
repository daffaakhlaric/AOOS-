import Link from "next/link";
import { Card } from "@/components/common/Card";
import type { StressTestFactCheckResultDto } from "@/lib/stress-test";
import { ToneBadge } from "./EvidenceBadge";
import styles from "./result.module.css";

/** Right rail "Status Validasi Fakta" — the real fact-check state. When no Listing Knowledge could
 * be checked, links to the real Listing Editor knowledge section for that listing. */
export function FactValidationStatusCard({
  factCheck,
  listingId,
}: {
  readonly factCheck: StressTestFactCheckResultDto;
  readonly listingId?: string;
}): React.ReactElement {
  const counts = {
    supported: factCheck.findings.filter((f) => f.status === "SUPPORTED").length,
    unsupported: factCheck.findings.filter((f) => f.status === "UNSUPPORTED_CLAIM").length,
    conflicting: factCheck.findings.filter((f) => f.status === "CONFLICTING_CLAIM").length,
  };
  return (
    <Card title="Status Validasi Fakta" variant="compact" testId="stress-test-fact-status-card">
      {factCheck.status === "CHECKED" ? (
        <>
          <ToneBadge
            tone={
              counts.conflicting > 0 ? "critical" : counts.unsupported > 0 ? "warning" : "success"
            }
          >
            Diperiksa terhadap Listing Knowledge
          </ToneBadge>
          <ul className={styles.railList} style={{ marginTop: 10 }}>
            <li>
              <span>Didukung</span>
              <strong>{counts.supported}</strong>
            </li>
            <li>
              <span>Tidak didukung</span>
              <strong>{counts.unsupported}</strong>
            </li>
            <li>
              <span>Bertentangan</span>
              <strong>{counts.conflicting}</strong>
            </li>
          </ul>
        </>
      ) : (
        <>
          <ToneBadge
            tone={factCheck.status === "FAILED" ? "critical" : "warning"}
            testId="stress-test-fact-status"
          >
            {factCheck.status === "FAILED" ? "Validasi gagal" : "Belum dapat diverifikasi"}
          </ToneBadge>
          <p className={styles.muted} style={{ marginTop: 8 }}>
            {factCheck.note}
          </p>
          {factCheck.status === "NOT_APPLICABLE" && listingId !== undefined ? (
            <Link
              href={`/listings/${encodeURIComponent(listingId)}/edit#knowledge`}
              className={styles.button}
              style={{ marginTop: 10 }}
              data-testid="stress-test-complete-knowledge-link"
            >
              Lengkapi Listing Knowledge
            </Link>
          ) : null}
        </>
      )}
    </Card>
  );
}
