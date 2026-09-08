import { ConflictError, NotFoundError } from "@aos/errors";
import { describe, expect, it, vi } from "vitest";

import { createFakeSupabaseClient } from "../../test-support/fake-supabase-client.js";
import type { AuditLogService } from "../audit-log/audit-log.service.js";
import type { CampaignsService } from "../campaigns/campaigns.service.js";
import type { CreatePropertyCampaignResponseDto } from "../campaigns/dto/create-property-campaign.dto.js";
import type { CreativePackagesService } from "../creative-packages/creative-packages.service.js";
import { CreativePackageRepository } from "../creative-packages/infrastructure/creative-package.repository.js";
import type { ModeGuardService } from "../mode-guard/mode-guard.service.js";

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

/** Minimal real `creative_packages` row, `PENDING_REVIEW` (AAOS LOOP UPGRADE, Sprint 8a) — for `REVIEW_CREATIVE_BRIEF` approve/reject tests. */
function seedCreativePackage(
  client: ReturnType<typeof createFakeSupabaseClient>,
  overrides: Record<string, unknown> = {},
): void {
  client.seed("creative_packages", {
    id: "cp-auto-1",
    tenant_id: "dss-motor",
    brief_id: "brief-auto-1",
    ad_id: null,
    stable_id: null,
    vertical: "PROPERTY",
    listing_id: "listing-1",
    branch: null,
    unit: null,
    unit_model: null,
    title: "[Auto] Refresh kreatif — Listing 1",
    angle: "READY_HUNI",
    target_persona: null,
    reason: "NEED_CREATIVE terdeteksi oleh Samantha.",
    requested_format: "IMAGES_ONLY",
    decided_format: null,
    primary_message: "Listing 1",
    urgency: "MEDIUM",
    origin: "SAMANTHA",
    status: "PENDING_REVIEW",
    ai_recommended: false,
    fatigue_status: "NORMAL",
    source: "auto_loop",
    related_verdict_id: "listing-1",
    priority: "MEDIUM",
    source_photo_urls: [],
    video_url: null,
    image_urls: [],
    copy_variants: [],
    ai_model: null,
    confidence_score: null,
    generation_ms: null,
    selected_copy_variant_id: null,
    error_message: null,
    generated_at: null,
    reviewed_at: null,
    campaign_publish_status: null,
    created_at: "2026-09-01T00:00:00.000Z",
    updated_at: "2026-09-01T00:00:00.000Z",
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

function buildFakeAuditLogService(): AuditLogService {
  return { record: vi.fn(async () => undefined) } as unknown as AuditLogService;
}

function buildFakeModeGuardService(): ModeGuardService {
  return { resolveMode: vi.fn(async () => "DEV") } as unknown as ModeGuardService;
}

/** AAOS LOOP UPGRADE, Sprint 8b — real fake for the new `triggerAutoLoopGeneration` auto-trigger dependency. Resolves to a minimal stub response by default; real per-test overrides (spy/reject) are passed in directly. */
function buildFakeCreativePackagesService(
  impl?: CreativePackagesService["triggerAutoLoopGeneration"],
): CreativePackagesService {
  return {
    triggerAutoLoopGeneration: vi.fn(
      impl ??
        (async () =>
          ({}) as Awaited<ReturnType<CreativePackagesService["triggerAutoLoopGeneration"]>>),
    ),
  } as unknown as CreativePackagesService;
}

function buildService(
  client: ReturnType<typeof createFakeSupabaseClient>,
  campaignsService: CampaignsService = buildFakeCampaignsService(),
  auditLog: AuditLogService = buildFakeAuditLogService(),
  creativePackagesService: CreativePackagesService = buildFakeCreativePackagesService(),
): {
  service: PendingActionsService;
  campaignsService: CampaignsService;
  auditLog: AuditLogService;
  creativePackagesService: CreativePackagesService;
} {
  const repository = new PendingActionRepository(client);
  const creativePackageRepository = new CreativePackageRepository(client);
  const service = new PendingActionsService(
    repository,
    campaignsService,
    auditLog,
    buildFakeModeGuardService(),
    creativePackageRepository,
    creativePackagesService,
    () => FIXED_NOW,
  );
  return { service, campaignsService, auditLog, creativePackagesService };
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

    it("AAOS LOOP UPGRADE Prompt 17: writes a real VERDICT_APPLIED audit_log row, plus CAMPAIGN_PUBLISHED for a real (non-simulated) result", async () => {
      const client = createFakeSupabaseClient();
      seedPendingAction(client);
      const auditLog = buildFakeAuditLogService();
      const { service } = buildService(client, buildFakeCampaignsService(), auditLog);

      await service.approve("pending-1", "dss-motor", "manager@dss-motor.id", undefined);

      expect(auditLog.record).toHaveBeenCalledWith(
        expect.objectContaining({ actionType: "VERDICT_APPLIED", decidedBy: "user_manual" }),
      );
      expect(auditLog.record).toHaveBeenCalledWith(
        expect.objectContaining({ actionType: "CAMPAIGN_PUBLISHED", reversible: true }),
      );
    });

    it("does not write a CAMPAIGN_PUBLISHED audit_log row for a DEV-mode simulated result", async () => {
      const client = createFakeSupabaseClient();
      seedPendingAction(client);
      const auditLog = buildFakeAuditLogService();
      const simulatedCampaigns = buildFakeCampaignsService(async () => ({
        simulated: true,
        resolvedCities: ["Jakarta"],
      }));
      const { service } = buildService(client, simulatedCampaigns, auditLog);

      await service.approve("pending-1", "dss-motor", undefined, undefined);

      const calls = (auditLog.record as ReturnType<typeof vi.fn>).mock.calls as Array<
        [{ actionType: string }]
      >;
      expect(calls.some(([arg]) => arg.actionType === "CAMPAIGN_PUBLISHED")).toBe(false);
    });

    it("AAOS LOOP UPGRADE Sprint 8a — REVIEW_CREATIVE_BRIEF: approving moves the real creative_packages row PENDING_REVIEW -> DRAFT, never calls CampaignsService", async () => {
      const client = createFakeSupabaseClient();
      seedPendingAction(client, {
        action_type: "REVIEW_CREATIVE_BRIEF",
        payload: { listingId: "listing-1", creativePackageId: "cp-auto-1" },
      });
      seedCreativePackage(client);
      const campaignsService = buildFakeCampaignsService();
      const creativePackagesService = buildFakeCreativePackagesService();
      const { service } = buildService(
        client,
        campaignsService,
        buildFakeAuditLogService(),
        creativePackagesService,
      );

      const result = await service.approve(
        "pending-1",
        "dss-motor",
        "manager@dss-motor.id",
        undefined,
      );

      expect(result.status).toBe("APPROVED");
      expect(campaignsService.createPropertyCampaign).not.toHaveBeenCalled();

      const creativeRepository = new CreativePackageRepository(client);
      const pkg = await creativeRepository.findById("dss-motor", "cp-auto-1");
      expect(pkg?.status).toBe("DRAFT");

      // AAOS LOOP UPGRADE, Sprint 8b — the real auto-trigger: approving a REVIEW_CREATIVE_BRIEF row
      // immediately calls triggerAutoLoopGeneration for the SAME real package, no second manual
      // click required (the human-approved path).
      expect(creativePackagesService.triggerAutoLoopGeneration).toHaveBeenCalledWith(
        "dss-motor",
        "cp-auto-1",
      );
    });

    it("AAOS LOOP UPGRADE Sprint 8b — REVIEW_CREATIVE_BRIEF approve: a triggerAutoLoopGeneration failure is swallowed, the Approve decision still succeeds", async () => {
      const client = createFakeSupabaseClient();
      seedPendingAction(client, {
        action_type: "REVIEW_CREATIVE_BRIEF",
        payload: { listingId: "listing-1", creativePackageId: "cp-auto-1" },
      });
      seedCreativePackage(client);
      const creativePackagesService = buildFakeCreativePackagesService(async () => {
        throw new Error("Kie AI unavailable");
      });
      const { service } = buildService(
        client,
        buildFakeCampaignsService(),
        buildFakeAuditLogService(),
        creativePackagesService,
      );

      const result = await service.approve("pending-1", "dss-motor", undefined, undefined);

      expect(result.status).toBe("APPROVED");
      const creativeRepository = new CreativePackageRepository(client);
      const pkg = await creativeRepository.findById("dss-motor", "cp-auto-1");
      expect(pkg?.status).toBe("DRAFT");
    });

    it("REVIEW_CREATIVE_BRIEF approve — throws ConflictError when the payload has no real creativePackageId", async () => {
      const client = createFakeSupabaseClient();
      seedPendingAction(client, {
        action_type: "REVIEW_CREATIVE_BRIEF",
        payload: { listingId: "listing-1" },
      });
      const { service } = buildService(client);

      await expect(service.approve("pending-1", "dss-motor", undefined, undefined)).rejects.toThrow(
        ConflictError,
      );
    });

    it("AAOS LOOP UPGRADE Sprint 8c — PUBLISH_CAMPAIGN_FROM_ASSET: approving calls the real CampaignsService.createPropertyCampaign, marks the asset PUBLISHED, and writes a real CAMPAIGN_PUBLISHED audit row for a non-simulated result", async () => {
      const client = createFakeSupabaseClient();
      seedPendingAction(client, {
        action_type: "PUBLISH_CAMPAIGN_FROM_ASSET",
        payload: { listingId: "listing-1", creativePackageId: "cp-auto-1" },
      });
      seedCreativePackage(client, { status: "PENDING" });
      const campaignsService = buildFakeCampaignsService(async () => ({
        simulated: false,
        resolvedCities: ["Jakarta Selatan"],
        campaignId: "campaign-real-1",
        adSetId: "adset-real-1",
      }));
      const auditLog = buildFakeAuditLogService();
      const { service } = buildService(client, campaignsService, auditLog);

      const result = await service.approve(
        "pending-1",
        "dss-motor",
        "manager@dss-motor.id",
        undefined,
      );

      expect(result.status).toBe("APPROVED");
      expect(campaignsService.createPropertyCampaign).toHaveBeenCalledWith(
        "dss-motor",
        { listingId: "listing-1" },
        expect.any(String),
      );
      const creativeRepository = new CreativePackageRepository(client);
      const pkg = await creativeRepository.findById("dss-motor", "cp-auto-1");
      expect(pkg?.campaignPublishStatus).toBe("PUBLISHED");
      expect(auditLog.record).toHaveBeenCalledWith(
        expect.objectContaining({
          actionType: "CAMPAIGN_PUBLISHED",
          decidedBy: "user_manual",
          reversible: true,
        }),
      );
    });

    it("PUBLISH_CAMPAIGN_FROM_ASSET approve — throws ConflictError when the payload has no real creativePackageId", async () => {
      const client = createFakeSupabaseClient();
      seedPendingAction(client, {
        action_type: "PUBLISH_CAMPAIGN_FROM_ASSET",
        payload: { listingId: "listing-1" },
      });
      const { service } = buildService(client);

      await expect(service.approve("pending-1", "dss-motor", undefined, undefined)).rejects.toThrow(
        ConflictError,
      );
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

    it("AAOS LOOP UPGRADE Sprint 8a — REVIEW_CREATIVE_BRIEF: rejecting moves the real creative_packages row PENDING_REVIEW -> REJECTED", async () => {
      const client = createFakeSupabaseClient();
      seedPendingAction(client, {
        action_type: "REVIEW_CREATIVE_BRIEF",
        payload: { listingId: "listing-1", creativePackageId: "cp-auto-1" },
      });
      seedCreativePackage(client);
      const { service } = buildService(client);

      const result = await service.reject(
        "pending-1",
        "dss-motor",
        "manager@dss-motor.id",
        "Tidak relevan",
      );

      expect(result.status).toBe("REJECTED");

      const creativeRepository = new CreativePackageRepository(client);
      const pkg = await creativeRepository.findById("dss-motor", "cp-auto-1");
      expect(pkg?.status).toBe("REJECTED");
    });

    it("AAOS LOOP UPGRADE Sprint 8c — PUBLISH_CAMPAIGN_FROM_ASSET: rejecting marks the real creative_packages row campaignPublishStatus SKIPPED, never calls CampaignsService", async () => {
      const client = createFakeSupabaseClient();
      seedPendingAction(client, {
        action_type: "PUBLISH_CAMPAIGN_FROM_ASSET",
        payload: { listingId: "listing-1", creativePackageId: "cp-auto-1" },
      });
      seedCreativePackage(client, { status: "PENDING" });
      const campaignsService = buildFakeCampaignsService();
      const { service } = buildService(client, campaignsService);

      const result = await service.reject(
        "pending-1",
        "dss-motor",
        "manager@dss-motor.id",
        "Belum yakin",
      );

      expect(result.status).toBe("REJECTED");
      expect(campaignsService.createPropertyCampaign).not.toHaveBeenCalled();

      const creativeRepository = new CreativePackageRepository(client);
      const pkg = await creativeRepository.findById("dss-motor", "cp-auto-1");
      expect(pkg?.campaignPublishStatus).toBe("SKIPPED");
    });

    it("AAOS LOOP UPGRADE Prompt 17: writes a real VERDICT_REJECTED audit_log row with a null after_state", async () => {
      const client = createFakeSupabaseClient();
      seedPendingAction(client);
      const auditLog = buildFakeAuditLogService();
      const { service } = buildService(client, buildFakeCampaignsService(), auditLog);

      await service.reject("pending-1", "dss-motor", "manager@dss-motor.id", "Tidak relevan");

      expect(auditLog.record).toHaveBeenCalledWith(
        expect.objectContaining({
          actionType: "VERDICT_REJECTED",
          decidedBy: "user_manual",
          afterState: null,
          reversible: false,
        }),
      );
    });
  });
});
