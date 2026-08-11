import type { AssignLead, LeadAssignment } from "@aos/branch-manager";
import { BranchId, SalesHumanId } from "@aos/branch-manager";
import { err, ok } from "@aos/common";
import { ValidationError } from "@aos/errors";
import { describe, expect, it, vi } from "vitest";

import { HandoffService } from "../../../../src/application/services/HandoffService.js";
import { LeadConversation } from "../../../../src/domain/entities/LeadConversation.js";
import { LeadProfile } from "../../../../src/domain/entities/LeadProfile.js";
import { JessyAgentEvents } from "../../../../src/domain/events/JessyAgentEvents.js";
import { LeadScore } from "../../../../src/domain/value-objects/LeadScore.js";
import { QualificationStatus } from "../../../../src/domain/value-objects/QualificationStatus.js";
import {
  fixedClock,
  makeRealBranchManager,
  FIXED_NOW,
} from "../../../fixtures/salesAgentFixtures.js";
import { createFakePublisher } from "../../../helpers/publisher.js";
import { unwrap, unwrapErr } from "../../../helpers/result.js";

describe("HandoffService (real @aos/branch-manager AssignLead)", () => {
  it("builds a HandoffPackage with the correct Indonesian summary", async () => {
    const jessyEvents = createFakePublisher();
    const branchManager = makeRealBranchManager();
    const service = new HandoffService(
      branchManager.assignLead,
      branchManager.salesTeamRegistry,
      new JessyAgentEvents(jessyEvents),
      fixedClock(),
    );
    const conversation = LeadConversation.start("+6281200000001", BranchId.CINERE, FIXED_NOW)
      .withProfile(
        LeadProfile.empty().withEnrichment({ unit: "Xpander" }, QualificationStatus.UNIT),
      )
      .withScore(unwrap(LeadScore.create(90)));

    const outcome = unwrap(
      await service.handoff({
        conversation,
        matchedUnits: [],
        tenantId: "tenant-dss-motor",
        correlationId: "corr-1",
      }),
    );
    expect(outcome.handoffPackage.conversationSummary).toContain("Xpander");
  });

  it("calls the real branch-manager AssignLead use case (status: ASSIGNED)", async () => {
    const branchManager = makeRealBranchManager();
    const service = new HandoffService(
      branchManager.assignLead,
      branchManager.salesTeamRegistry,
      new JessyAgentEvents(createFakePublisher()),
      fixedClock(),
    );
    const conversation = LeadConversation.start(
      "+6281200000001",
      BranchId.CINERE,
      FIXED_NOW,
    ).withScore(unwrap(LeadScore.create(90)));
    const outcome = unwrap(
      await service.handoff({
        conversation,
        matchedUnits: [],
        tenantId: "tenant-dss-motor",
        correlationId: "corr-1",
      }),
    );
    expect(outcome.salesName).toBe(`Sales ${BranchId.CINERE}`);
  });

  it("publishes HandoffTriggered", async () => {
    const jessyEvents = createFakePublisher();
    const branchManager = makeRealBranchManager();
    const service = new HandoffService(
      branchManager.assignLead,
      branchManager.salesTeamRegistry,
      new JessyAgentEvents(jessyEvents),
      fixedClock(),
    );
    const conversation = LeadConversation.start(
      "+6281200000001",
      BranchId.CINERE,
      FIXED_NOW,
    ).withScore(unwrap(LeadScore.create(90)));
    await service.handoff({
      conversation,
      matchedUnits: [],
      tenantId: "tenant-dss-motor",
      correlationId: "corr-1",
    });
    expect(jessyEvents.published.some((p) => p.type === "aaos.sales.handoff.triggered")).toBe(true);
  });

  it("prepares a handoff OutgoingMessage payload (whatsapp-connector types) — never sends", async () => {
    const branchManager = makeRealBranchManager();
    const service = new HandoffService(
      branchManager.assignLead,
      branchManager.salesTeamRegistry,
      new JessyAgentEvents(createFakePublisher()),
      fixedClock(),
    );
    const conversation = LeadConversation.start(
      "+6281200000001",
      BranchId.CINERE,
      FIXED_NOW,
    ).withScore(unwrap(LeadScore.create(90)));
    const outcome = unwrap(
      await service.handoff({
        conversation,
        matchedUnits: [],
        tenantId: "tenant-dss-motor",
        correlationId: "corr-1",
      }),
    );
    expect(outcome.outgoingMessage.to.toString()).toBe("+6281200000001");
    expect(outcome.outgoingMessage.body.toString()).toContain(outcome.salesName);
  });

  it("falls back to a default sales name when no sales human is available (QUEUED)", async () => {
    const branchManager = makeRealBranchManager();
    // Remove every Cinere sales human so AssignLead must queue instead of assign.
    for (const sales of branchManager.salesTeamRegistry.getByBranch(BranchId.CINERE)) {
      branchManager.salesTeamRegistry.remove(sales.id);
    }
    const service = new HandoffService(
      branchManager.assignLead,
      branchManager.salesTeamRegistry,
      new JessyAgentEvents(createFakePublisher()),
      fixedClock(),
    );
    const conversation = LeadConversation.start(
      "+6281200000001",
      BranchId.CINERE,
      FIXED_NOW,
    ).withScore(unwrap(LeadScore.create(90)));
    const outcome = unwrap(
      await service.handoff({
        conversation,
        matchedUnits: [],
        tenantId: "tenant-dss-motor",
        correlationId: "corr-1",
      }),
    );
    expect(outcome.salesName).toBe("tim sales kita");
  });

  it("returns a HandoffError when the underlying phone number is invalid", async () => {
    const branchManager = makeRealBranchManager();
    const service = new HandoffService(
      branchManager.assignLead,
      branchManager.salesTeamRegistry,
      new JessyAgentEvents(createFakePublisher()),
      fixedClock(),
    );
    const conversation = LeadConversation.start(
      "0812-invalid",
      BranchId.CINERE,
      FIXED_NOW,
    ).withScore(unwrap(LeadScore.create(90)));
    const result = await service.handoff({
      conversation,
      matchedUnits: [],
      tenantId: "tenant-dss-motor",
      correlationId: "corr-1",
    });
    expect(unwrapErr(result).message).toContain("PhoneNumber");
  });

  it("returns a HandoffError when the underlying AssignLead use case fails", async () => {
    const branchManager = makeRealBranchManager();
    const failingAssignLead = {
      execute: vi.fn(async () => err(new ValidationError("assignment rejected"))),
    } as unknown as AssignLead;
    const service = new HandoffService(
      failingAssignLead,
      branchManager.salesTeamRegistry,
      new JessyAgentEvents(createFakePublisher()),
      fixedClock(),
    );
    const conversation = LeadConversation.start(
      "+6281200000001",
      BranchId.CINERE,
      FIXED_NOW,
    ).withScore(unwrap(LeadScore.create(90)));
    const result = await service.handoff({
      conversation,
      matchedUnits: [],
      tenantId: "tenant-dss-motor",
      correlationId: "corr-1",
    });
    expect(unwrapErr(result).message).toBe("assignment rejected");
  });

  it("falls back to the default sales name when ASSIGNED but the sales human can't be resolved", async () => {
    const branchManager = makeRealBranchManager();
    const orphanAssignLead = {
      execute: vi.fn(async () =>
        ok({
          status: "ASSIGNED" as const,
          assignment: { salesHumanId: SalesHumanId.generate() } as unknown as LeadAssignment,
        }),
      ),
    } as unknown as AssignLead;
    const service = new HandoffService(
      orphanAssignLead,
      branchManager.salesTeamRegistry,
      new JessyAgentEvents(createFakePublisher()),
      fixedClock(),
    );
    const conversation = LeadConversation.start(
      "+6281200000001",
      BranchId.CINERE,
      FIXED_NOW,
    ).withScore(unwrap(LeadScore.create(90)));
    const outcome = unwrap(
      await service.handoff({
        conversation,
        matchedUnits: [],
        tenantId: "tenant-dss-motor",
        correlationId: "corr-1",
      }),
    );
    expect(outcome.salesName).toBe("tim sales kita");
  });

  it("uses the real wall clock when no clock is injected", async () => {
    const branchManager = makeRealBranchManager();
    const service = new HandoffService(
      branchManager.assignLead,
      branchManager.salesTeamRegistry,
      new JessyAgentEvents(createFakePublisher()),
    );
    const conversation = LeadConversation.start(
      "+6281200000001",
      BranchId.CINERE,
      new Date(),
    ).withScore(unwrap(LeadScore.create(90)));
    const outcome = unwrap(
      await service.handoff({
        conversation,
        matchedUnits: [],
        tenantId: "tenant-dss-motor",
        correlationId: "corr-1",
      }),
    );
    expect(outcome.salesName.length).toBeGreaterThan(0);
  });
});
