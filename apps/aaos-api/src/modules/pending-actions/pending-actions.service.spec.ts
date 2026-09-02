import { ConflictError, NotFoundError } from "@aos/errors";
import { describe, expect, it, vi } from "vitest";

import { createFakeSupabaseClient } from "../../test-support/fake-supabase-client.js";
import type { CampaignsService } from "../campaigns/campaigns.service.js";
import type { CreatePropertyCampaignResponseDto } from "../campaigns/dto/create-property-campaign.dto.js";

import {
  PendingActionRepository,
  type PendingActionRow,
} from "./infrastructure/pending-action.repository.js";
import { PendingActionsService } from "./pending-actions.service.js";

const FIXED_NOW = new Date("2026-09-01T12:00:00.000Z");

function seedPendingAction(
  client: ReturnType<typeof createFakeSupabaseClient>,
  overrides: Partial<PendingActionRow> = {},
): void {
  client.seed("pending_agent_actions", {
    id: "pending-1",
    tenant_id: "dss-motor",
    agent: "SAMANTHA",
    action_type: "CREATE_PROPERTY_CAMPAIGN",
    payload: { listingId: "listing-1" },
    status: "PENDING",
    decided_by: null,
    decision_notes: null,
    decided_at: null,
    created_at: "2026-08-01T00:00:00.000Z",
    ...overrides,
  });
}

function buildFakeCampaignsService(
  impl?: (
    tenantId: string,
    body: unknown,
    correlationId: string,
  ) => Promise<CreatePropertyCampaignResponseDto>,
): CampaignsService {
  return {
    createPropertyCampaign: vi.fn(
      impl ??
        (async () => ({
          simulated: false,
          resolvedCities: ["Jakarta"],
          campaignId: "campaign-1",
          adSetId: "adset-1",
        })),
    ),
  } as unknown as CampaignsService;
}

function buildService(
  client: ReturnType<typeof createFakeSupabaseClient>,
  campaignsService: CampaignsService = buildFakeCampaignsService(),
): { service: PendingActionsService; campaignsService: CampaignsService } {
  const repository = new PendingActionRepository(client);
  const service = new PendingActionsService(repository, campaignsService, () => FIXED_NOW);
  return { service, campaignsService };
}

describe("PendingActionsService", () => {
  describe("enqueue", () => {
    it("writes a real PENDING pending_agent_actions row (never touches Meta/CampaignsService)", async () => {
      const client = createFakeSupabaseClient();
      const { service } = buildService(client);

      await service.enqueue({
        tenantId: "dss-motor",
        agent: "SAMANTHA",
        actionType: "CREATE_PROPERTY_CAMPAIGN",
        payload: { listingId: "listing-1" },
      });

      const rows = await service.listPending("dss-motor");
      expect(rows).toHaveLength(1);
      expect(rows[0]?.status).toBe("PENDING");
      expect(rows[0]?.payload).toEqual({ listingId: "listing-1" });
      expect(rows[0]?.agent).toBe("SAMANTHA");
      expect(rows[0]?.action_type).toBe("CREATE_PROPERTY_CAMPAIGN");
    });
  });

  describe("listPending", () => {
    it("lists only the calling tenant's rows", async () => {
      const client = createFakeSupabaseClient();
      seedPendingAction(client, { id: "pending-1", tenant_id: "dss-motor" });
      seedPendingAction(client, { id: "pending-2", tenant_id: "other-tenant" });
      const { service } = buildService(client);

      const rows = await service.listPending("dss-motor");
      expect(rows.map((row) => row.id)).toEqual(["pending-1"]);
    });
  });

  describe("approve", () => {
    it("calls the REAL CampaignsService.createPropertyCampaign with the stored real payload and marks the row APPROVED", async () => {
      const client = createFakeSupabaseClient();
      seedPendingAction(client, { payload: { listingId: "listing-42" } });
      const campaignsService = buildFakeCampaignsService();
      const { service } = buildService(client, campaignsService);

      const result = await service.approve(
        "pending-1",
        "dss-motor",
        "manager@dss-motor.id",
        "Disetujui",
      );

      expect(campaignsService.createPropertyCampaign).toHaveBeenCalledWith(
        "dss-motor",
        { listingId: "listing-42" },
        expect.any(String),
      );
      expect(result.status).toBe("APPROVED");
      expect(result.decided_by).toBe("manager@dss-motor.id");
      expect(result.decision_notes).toBe("Disetujui");
      expect(result.decided_at).toBe(FIXED_NOW.toISOString());
    });

    it("throws NotFoundError for a missing id", async () => {
      const client = createFakeSupabaseClient();
      const { service } = buildService(client);
      await expect(service.approve("missing", "dss-motor", undefined, undefined)).rejects.toThrow(
        NotFoundError,
      );
    });

    it("throws NotFoundError when the row belongs to a different tenant (no cross-tenant approve)", async () => {
      const client = createFakeSupabaseClient();
      seedPendingAction(client, { tenant_id: "dss-motor" });
      const { service } = buildService(client);
      await expect(
        service.approve("pending-1", "other-tenant", undefined, undefined),
      ).rejects.toThrow(NotFoundError);
    });

    it("throws ConflictError (409) for an already-decided row and never calls createPropertyCampaign again", async () => {
      const client = createFakeSupabaseClient();
      seedPendingAction(client, { status: "APPROVED", decided_at: "2026-08-01T00:00:00.000Z" });
      const campaignsService = buildFakeCampaignsService();
      const { service } = buildService(client, campaignsService);

      await expect(service.approve("pending-1", "dss-motor", undefined, undefined)).rejects.toThrow(
        ConflictError,
      );
      expect(campaignsService.createPropertyCampaign).not.toHaveBeenCalled();
    });
  });

  describe("reject", () => {
    it("marks the row REJECTED and never calls CampaignsService.createPropertyCampaign", async () => {
      const client = createFakeSupabaseClient();
      seedPendingAction(client);
      const campaignsService = buildFakeCampaignsService();
      const { service } = buildService(client, campaignsService);

      const result = await service.reject(
        "pending-1",
        "dss-motor",
        "manager@dss-motor.id",
        "Tidak relevan",
      );

      expect(result.status).toBe("REJECTED");
      expect(result.decided_by).toBe("manager@dss-motor.id");
      expect(result.decision_notes).toBe("Tidak relevan");
      expect(campaignsService.createPropertyCampaign).not.toHaveBeenCalled();
    });

    it("throws ConflictError (409) for an already-decided row", async () => {
      const client = createFakeSupabaseClient();
      seedPendingAction(client, { status: "REJECTED", decided_at: "2026-08-01T00:00:00.000Z" });
      const { service } = buildService(client);
      await expect(service.reject("pending-1", "dss-motor", undefined, undefined)).rejects.toThrow(
        ConflictError,
      );
    });

    it("throws NotFoundError when the row belongs to a different tenant (no cross-tenant reject)", async () => {
      const client = createFakeSupabaseClient();
      seedPendingAction(client, { tenant_id: "dss-motor" });
      const { service } = buildService(client);
      await expect(
        service.reject("pending-1", "other-tenant", undefined, undefined),
      ).rejects.toThrow(NotFoundError);
    });
  });
});
