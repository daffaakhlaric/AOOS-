import type { SupabaseClientLike } from "@aos/lead-store";
import { expect, it, vi } from "vitest";

import type { CampaignAssessmentRow } from "../campaign-health/infrastructure/campaign-assessment.repository.js";

import { ActionEvidenceService, validateActionEvidence } from "./action-evidence.service.js";
import type { ActionCommand } from "./action.types.js";
const now = Date.parse("2026-10-22T12:00:00Z");
function fixture() {
  const command = {
    tenantId: "a",
    entityId: "100",
    entityType: "CAMPAIGN",
    actionType: "PAUSE_CAMPAIGN",
    actor: { type: "SAMANTHA" },
    evidenceSnapshotId: "e",
    reason: "cost",
  } as ActionCommand;
  const row = {
    id: "e",
    tenant_id: "a",
    meta_campaign_id: "100",
    assessed_at: new Date(now).toISOString(),
    decision: { decision: "PAUSE", reason: "cost" },
  } as CampaignAssessmentRow;
  return { command, row };
}
it("accepts matching fresh persisted evidence", () => {
  const f = fixture();
  expect(() => validateActionEvidence(f.command, f.row, now)).not.toThrow();
});
it.each([null, "tenant", "campaign", "reason", "decision", "expired", "future", "invalid"])(
  "rejects invalid evidence: %s",
  (kind) => {
    const { command, row } = fixture();
    const changed =
      kind === null
        ? null
        : ({
            ...row,
            ...(kind === "tenant" ? { tenant_id: "b" } : {}),
            ...(kind === "campaign" ? { meta_campaign_id: "200" } : {}),
            ...(kind === "reason" ? { decision: { ...row.decision, reason: "changed" } } : {}),
            ...(kind === "decision" ? { decision: { ...row.decision, decision: "MONITOR" } } : {}),
            ...(["expired", "future", "invalid"].includes(kind)
              ? {
                  assessed_at:
                    kind === "invalid"
                      ? "bad"
                      : new Date(now + (kind === "future" ? 1000 : -25 * 3600000)).toISOString(),
                }
              : {}),
          } as CampaignAssessmentRow | null);
    expect(() => validateActionEvidence(command, changed, now)).toThrow();
  },
);
it("rejects superseded assessment using tenant-scoped reads", async () => {
  const f = fixture();
  const row = { ...f.row, assessed_at: new Date().toISOString() };
  const query = {
    select: vi.fn(),
    eq: vi.fn(),
    order: vi.fn(),
    limit: vi.fn(async () => ({ data: [{ id: "new" }], error: null })),
    maybeSingle: vi.fn(async () => ({ data: row, error: null })),
  };
  query.select.mockReturnValue(query);
  query.eq.mockReturnValue(query);
  query.order.mockReturnValue(query);
  const service = new ActionEvidenceService({
    from: vi.fn(() => query),
  } as unknown as SupabaseClientLike);
  await expect(service.verify(f.command)).rejects.toThrow("ACTION_EVIDENCE_SUPERSEDED");
  expect(query.eq).toHaveBeenCalledWith("tenant_id", "a");
  expect(query.eq).toHaveBeenCalledWith("meta_campaign_id", "100");
});
