import { BranchId } from "@aos/branch-manager";
import { describe, expect, it } from "vitest";

import { LeadScoringService } from "../../../../src/application/services/LeadScoringService.js";
import { JessyAgentEvents } from "../../../../src/domain/events/JessyAgentEvents.js";
import { LeadScore } from "../../../../src/domain/value-objects/LeadScore.js";
import { ScoreDelta } from "../../../../src/domain/value-objects/ScoreDelta.js";
import { createFakePublisher } from "../../../helpers/publisher.js";

const BASE_INPUT = {
  conversationId: "c1",
  leadPhone: "+6281200000001",
  branchId: BranchId.CINERE,
  tenantId: "tenant-dss-motor",
  correlationId: "corr-1",
};

describe("LeadScoringService", () => {
  it("score accumulates across messages", async () => {
    const publisher = createFakePublisher();
    const service = new LeadScoringService(new JessyAgentEvents(publisher), 65);
    const first = await service.recordScoring({
      ...BASE_INPUT,
      previousScore: LeadScore.zero(),
      appliedDeltas: [ScoreDelta.of("BUDGET", 25)],
    });
    const second = await service.recordScoring({
      ...BASE_INPUT,
      previousScore: first.newScore,
      appliedDeltas: [ScoreDelta.of("UNIT", 25)],
    });
    expect(second.newScore.toNumber()).toBe(50);
  });

  it("score update emits LeadScoreUpdated event", async () => {
    const publisher = createFakePublisher();
    const service = new LeadScoringService(new JessyAgentEvents(publisher), 65);
    await service.recordScoring({
      ...BASE_INPUT,
      previousScore: LeadScore.zero(),
      appliedDeltas: [ScoreDelta.of("BUDGET", 25)],
    });
    expect(publisher.published.some((p) => p.type === "aaos.sales.lead.score-updated")).toBe(true);
  });

  it("score ≥ 65 emits LeadBecameHot event", async () => {
    const publisher = createFakePublisher();
    const service = new LeadScoringService(new JessyAgentEvents(publisher), 65);
    const outcome = await service.recordScoring({
      ...BASE_INPUT,
      previousScore: LeadScore.zero().apply(50),
      appliedDeltas: [ScoreDelta.of("UNIT", 25)],
    });
    expect(outcome.becameHot).toBe(true);
    expect(publisher.published.some((p) => p.type === "aaos.sales.lead.became-hot")).toBe(true);
  });

  it("does not re-emit LeadBecameHot if the score was already hot", async () => {
    const publisher = createFakePublisher();
    const service = new LeadScoringService(new JessyAgentEvents(publisher), 65);
    const outcome = await service.recordScoring({
      ...BASE_INPUT,
      previousScore: LeadScore.zero().apply(70),
      appliedDeltas: [ScoreDelta.of("TIMELINE", 10)],
    });
    expect(outcome.becameHot).toBe(false);
    expect(publisher.published.some((p) => p.type === "aaos.sales.lead.became-hot")).toBe(false);
  });

  it("clamps the score at 0 across multiple negative deltas (floor)", async () => {
    const publisher = createFakePublisher();
    const service = new LeadScoringService(new JessyAgentEvents(publisher), 65);
    const outcome = await service.recordScoring({
      ...BASE_INPUT,
      previousScore: LeadScore.zero(),
      appliedDeltas: [ScoreDelta.of("NOT_SERIOUS", -20), ScoreDelta.of("NO_REPLY", -10)],
    });
    expect(outcome.newScore.toNumber()).toBe(0);
  });

  it("clamps the score at 100 (ceiling)", async () => {
    const publisher = createFakePublisher();
    const service = new LeadScoringService(new JessyAgentEvents(publisher), 65);
    const outcome = await service.recordScoring({
      ...BASE_INPUT,
      previousScore: LeadScore.zero().apply(90),
      appliedDeltas: [ScoreDelta.of("UNIT", 25)],
    });
    expect(outcome.newScore.toNumber()).toBe(100);
  });

  it("emits zero events when there are no applied deltas and not hot", async () => {
    const publisher = createFakePublisher();
    const service = new LeadScoringService(new JessyAgentEvents(publisher), 65);
    await service.recordScoring({
      ...BASE_INPUT,
      previousScore: LeadScore.zero(),
      appliedDeltas: [],
    });
    expect(publisher.published).toHaveLength(0);
  });
});
