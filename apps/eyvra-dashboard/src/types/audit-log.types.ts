/**
 * Mirrors `apps/aaos-api`'s `modules/audit-log/dto/audit-log.dto.ts` `AuditLogResponseDto` exactly
 * (AAOS LOOP UPGRADE, Sprint 6 Prompt 17) — the wire contract between this app's `/api/audit-log*`
 * route handlers and the real backend.
 */
export interface AuditLogDto {
  readonly id: string;
  readonly tenantId: string;
  readonly agent: string;
  readonly actionType: string;
  readonly beforeState: unknown;
  readonly afterState: unknown;
  readonly decidedBy: "ai_auto" | "user_manual";
  readonly userId?: string;
  readonly mode: "DEV" | "LIVE";
  readonly relatedVerdictId?: string;
  readonly relatedBriefId?: string;
  readonly reversible: boolean;
  readonly createdAt: string;
}
