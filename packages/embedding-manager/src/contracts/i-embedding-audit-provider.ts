import type { EmbeddingAudit } from "../domain/embedding-audit.js";

/** "IEmbeddingAuditProvider" — interface ONLY. A caller-supplied sink (SIEM, compliance store) that mirrors `EmbeddingAudit` entries externally. */
export interface IEmbeddingAuditProvider {
  record(audit: EmbeddingAudit): Promise<void>;
}
