import { BranchId } from "@aos/branch-manager";
import { describe, expect, it } from "vitest";

import { PropertyHandoffService } from "../../../../src/application/services/PropertyHandoffService.js";
import { PropertyTriggerHandoff } from "../../../../src/application/use-cases/PropertyTriggerHandoff.js";
import { LeadConversation } from "../../../../src/domain/entities/LeadConversation.js";
import { ClaraAgentEvents } from "../../../../src/domain/events/ClaraAgentEvents.js";
import { LeadScore } from "../../../../src/domain/value-objects/LeadScore.js";
import {
  fixedClock,
  makeRealBranchManager,
  FIXED_NOW,
} from "../../../fixtures/salesAgentFixtures.js";
import { createFakePublisher } from "../../../helpers/publisher.js";
import { unwrap } from "../../../helpers/result.js";
import { createFakeTracer } from "../../../helpers/tracer.js";

describe("PropertyTriggerHandoff", () => {
  it("traces and delegates to PropertyHandoffService.handoff", async () => {
    const branchManager = makeRealBranchManager();
    const handoffService = new PropertyHandoffService(
      branchManager.assignLead,
      branchManager.salesTeamRegistry,
      new ClaraAgentEvents(createFakePublisher()),
      fixedClock(),
    );
    const useCase = new PropertyTriggerHandoff(handoffService, createFakeTracer());
    const conversation = LeadConversation.start(
      "+6281200000001",
      BranchId.CINERE,
      FIXED_NOW,
    ).withScore(unwrap(LeadScore.create(90)));
    const outcome = unwrap(
      await useCase.execute({
        conversation,
        matchedListings: [],
        tenantId: "tenant-dss-motor",
        correlationId: "corr-1",
      }),
    );
    expect(outcome.salesName.length).toBeGreaterThan(0);
  });
});
