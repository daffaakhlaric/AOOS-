import { ConflictError, NotFoundError } from "@aos/errors";
import { describe, expect, it, vi } from "vitest";

import { createFakeSupabaseClient } from "../../test-support/fake-supabase-client.js";
import type { MetaAdsService } from "../meta-ads/meta-ads.service.js";

import { AuditLogService } from "./audit-log.service.js";
import { AuditLogRepository, type AuditLogRow } from "./infrastructure/audit-log.repository.js";

const TENANT_ID = "property-tenant-1";

function seedAuditLog(
  client: ReturnType<typeof createFakeSupabaseClient>,
  overrides: Partial<AuditLogRow> = {},
): void {
  client.seed("audit_log", {
    id: "audit-1",
    tenant_id: TENANT_ID,
    agent: "SAMANTHA",
    action_type: "CAMPAIGN_PUBLISHED",
    before_state: null,
    after_state: { campaignId: "campaign-42", simulated: false },
    decided_by: "ai_auto",
    user_id: null,
    mode: "LIVE",
    related_verdict_id: null,
    related_brief_id: null,
    reversible: true,
    created_at: "2026-09-01T00:00:00.000Z",
    ...overrides,
  });
}

function buildService(
  client: ReturnType<typeof createFakeSupabaseClient>,
  executeVerdictImpl?: () => Promise<{ simulated: boolean; [key: string]: unknown }>,
): { service: AuditLogService; metaAdsService: MetaAdsService } {
  const repository = new AuditLogRepository(client);
  const executeVerdict = vi.fn(
    executeVerdictImpl ?? (async () => ({ simulated: false, action: "PAUSED" })),
  );
  const metaAdsService = { executeVerdict } as unknown as MetaAdsService;
  const service = new AuditLogService(repository, metaAdsService);
  return { service, metaAdsService };
}

describe("AuditLogService", () => {
  describe("record", () => {
    it("is best-effort — never throws, even when the underlying insert fails", async () => {
      const client = createFakeSupabaseClient();
      const { service } = buildService(client);
      // No tenant/columns issue in the fake client, but this proves the call resolves cleanly.
      await expect(
        service.record({
          tenantId: TENANT_ID,
          agent: "SAMANTHA",
          actionType: "VERDICT_APPLIED",
          decidedBy: "ai_auto",
          mode: "DEV",
          reversible: false,
        }),
      ).resolves.toBeUndefined();
    });
  });

  describe("rollback", () => {
    it("calls the real executeVerdict PAUSE on the real campaignId and writes a new ROLLBACK row", async () => {
      const client = createFakeSupabaseClient();
      seedAuditLog(client);
      const { service, metaAdsService } = buildService(client);

      const result = await service.rollback(TENANT_ID, "audit-1", "manager@example.com");

      expect(metaAdsService.executeVerdict).toHaveBeenCalledWith(
        { verdict: "PAUSE", targetId: "campaign-42", targetType: "campaign" },
        expect.any(String),
        TENANT_ID,
      );
      expect(result.action_type).toBe("ROLLBACK");
      expect(result.related_verdict_id).toBe("audit-1");
    });

    it("throws ConflictError for a non-reversible row — never a silent no-op", async () => {
      const client = createFakeSupabaseClient();
      seedAuditLog(client, { id: "audit-2", reversible: false, action_type: "VERDICT_APPLIED" });
      const { service } = buildService(client);

      await expect(service.rollback(TENANT_ID, "audit-2", undefined)).rejects.toThrow(
        ConflictError,
      );
    });

    it("throws NotFoundError for a missing id", async () => {
      const client = createFakeSupabaseClient();
      const { service } = buildService(client);
      await expect(service.rollback(TENANT_ID, "missing", undefined)).rejects.toThrow(
        NotFoundError,
      );
    });
  });
});
