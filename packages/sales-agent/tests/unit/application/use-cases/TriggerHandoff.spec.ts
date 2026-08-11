import { BranchId } from "@aos/branch-manager";
import { describe, expect, it } from "vitest";

import { HandoffService } from "../../../../src/application/services/HandoffService.js";
import { TriggerHandoff } from "../../../../src/application/use-cases/TriggerHandoff.js";
import { LeadConversation } from "../../../../src/domain/entities/LeadConversation.js";
import { JessyAgentEvents } from "../../../../src/domain/events/JessyAgentEvents.js";
import { LeadScore } from "../../../../src/domain/value-objects/LeadScore.js";
import {
  fixedClock,
  makeRealBranchManager,
  FIXED_NOW,
} from "../../../fixtures/salesAgentFixtures.js";
import { createFakePublisher } from "../../../helpers/publisher.js";
import { unwrap } from "../../../helpers/result.js";
import { createFakeTracer } from "../../../helpers/tracer.js";

describe("TriggerHandoff", () => {
  it("traces and delegates to HandoffService.handoff", async () => {
    const branchManager = makeRealBranchManager();
    const handoffService = new HandoffService(
      branchManager.assignLead,
      branchManager.salesTeamRegistry,
      new JessyAgentEvents(createFakePublisher()),
      fixedClock(),
    );
    const useCase = new TriggerHandoff(handoffService, createFakeTracer());
    const conversation = LeadConversation.start(
      "+6281200000001",
      BranchId.CINERE,
      FIXED_NOW,
    ).withScore(unwrap(LeadScore.create(90)));
    const outcome = unwrap(
      await useCase.execute({
        conversation,
        matchedUnits: [],
        tenantId: "tenant-dss-motor",
        correlationId: "corr-1",
      }),
    );
    expect(outcome.salesName.length).toBeGreaterThan(0);
  });
});
