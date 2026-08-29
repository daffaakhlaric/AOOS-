import { BranchId } from "@aos/branch-manager";
import { describe, expect, it } from "vitest";

import { PropertyLeadScoringService } from "../../../../src/application/services/PropertyLeadScoringService.js";
import { ClaraAgentEvents } from "../../../../src/domain/events/ClaraAgentEvents.js";
import { LeadScore } from "../../../../src/domain/value-objects/LeadScore.js";
import { PropertyScoreDelta } from "../../../../src/domain/value-objects/PropertyScoreDelta.js";
import { createFakePublisher } from "../../../helpers/publisher.js";

const BASE_INPUT = {
  conversationId: "c1",
  leadPhone: "+6281200000001",
  branchId: BranchId.CINERE,
  tenantId: "tenant-dss-motor",
  correlationId: "corr-1",
};

describe("PropertyLeadScoringService", () => {
  it("score accumulates across messages", async () => {
    const publisher = createFakePublisher();
    const service = new PropertyLeadScoringService(new ClaraAgentEvents(publisher), 65);
    const first = await service.recordScoring({
      ...BASE_INPUT,
      previousScore: LeadScore.zero(),
      appliedDeltas: [PropertyScoreDelta.of("BUDGET", 20)],
    });
    const second = await service.recordScoring({
      ...BASE_INPUT,
      previousScore: first.newScore,
      appliedDeltas: [PropertyScoreDelta.of("AREA", 20)],
    });
    expect(second.newScore.toNumber()).toBe(40);
  });

  it("score update emits PropertyLeadScoreUpdated event", async () => {
    const publisher = createFakePublisher();
    const service = new PropertyLeadScoringService(new ClaraAgentEvents(publisher), 65);
    await service.recordScoring({
      ...BASE_INPUT,
      previousScore: LeadScore.zero(),
      appliedDeltas: [PropertyScoreDelta.of("BUDGET", 20)],
    });
    expect(
      publisher.published.some((p) => p.type === "aaos.sales.property-lead.score-updated"),
    ).toBe(true);
  });

  it("score >= 65 emits LeadBecameHot event", async () => {
    const publisher = createFakePublisher();
    const service = new PropertyLeadScoringService(new ClaraAgentEvents(publisher), 65);
    const outcome = await service.recordScoring({
      ...BASE_INPUT,
      previousScore: LeadScore.zero().apply(50),
      appliedDeltas: [PropertyScoreDelta.of("AREA", 20)],
    });
    expect(outcome.becameHot).toBe(true);
    expect(publisher.published.some((p) => p.type === "aaos.sales.lead.became-hot")).toBe(true);
  });

  it("does not re-emit LeadBecameHot if the score was already hot", async () => {
    const publisher = createFakePublisher();
    const service = new PropertyLeadScoringService(new ClaraAgentEvents(publisher), 65);
    const outcome = await service.recordScoring({
      ...BASE_INPUT,
      previousScore: LeadScore.zero().apply(70),
      appliedDeltas: [PropertyScoreDelta.of("TIMELINE", 20)],
    });
    expect(outcome.becameHot).toBe(false);
    expect(publisher.published.some((p) => p.type === "aaos.sales.lead.became-hot")).toBe(false);
  });

  it("clamps the score at 100 (ceiling)", async () => {
    const publisher = createFakePublisher();
    const service = new PropertyLeadScoringService(new ClaraAgentEvents(publisher), 65);
    const outcome = await service.recordScoring({
      ...BASE_INPUT,
      previousScore: LeadScore.zero().apply(90),
      appliedDeltas: [PropertyScoreDelta.of("AREA", 20)],
    });
    expect(outcome.newScore.toNumber()).toBe(100);
  });

  it("emits zero events when there are no applied deltas and not hot", async () => {
    const publisher = createFakePublisher();
    const service = new PropertyLeadScoringService(new ClaraAgentEvents(publisher), 65);
    await service.recordScoring({
      ...BASE_INPUT,
      previousScore: LeadScore.zero(),
      appliedDeltas: [],
    });
    expect(publisher.published).toHaveLength(0);
  });

  it("uses the real wall clock when no clock is injected", async () => {
    const publisher = createFakePublisher();
    const service = new PropertyLeadScoringService(new ClaraAgentEvents(publisher), 65);
    const outcome = await service.recordScoring({
      ...BASE_INPUT,
      previousScore: LeadScore.zero(),
      appliedDeltas: [PropertyScoreDelta.of("BUDGET", 20)],
    });
    expect(outcome.newScore.toNumber()).toBe(20);
  });
});
