import { describe, expect, it } from "vitest";

import { DigestService } from "../../../../src/application/services/DigestService.js";
import { ExecutionPlan } from "../../../../src/domain/entities/ExecutionPlan.js";
import { MetaAdsAgentEvents } from "../../../../src/domain/events/MetaAdsAgentEvents.js";
import { ExecutionPlanId } from "../../../../src/domain/value-objects/ExecutionPlanId.js";
import { buildObjectiveProgressFixture } from "../../../fixtures/objectiveFixtures.js";
import { createFakePublisher } from "../../../helpers/publisher.js";
import { unwrap } from "../../../helpers/result.js";

describe("DigestService.generate", () => {
  it("builds and returns a DailyDigest, publishing DigestGenerated", async () => {
    const publisher = createFakePublisher();
    const events = new MetaAdsAgentEvents(publisher);
    const service = new DigestService(events);
    const plan = unwrap(
      ExecutionPlan.create({
        id: ExecutionPlanId.generate(),
        tenantId: "dss-motor",
        decisions: [],
        generatedAt: new Date(),
      }),
    );

    const result = await service.generate(
      {
        tenantId: "dss-motor",
        date: new Date("2026-08-09T00:00:00.000Z"),
        targetHotLeads: 50,
        budgetAllocationIDR: 30_000_000,
        progress: buildObjectiveProgressFixture(),
        plan,
        creativeBriefs: [],
        escalations: [],
        adFindings: [],
      },
      "corr-1",
    );

    expect(result.ok).toBe(true);
    expect(publisher.published.some((p) => p.type === "aaos.samantha.digest.generated")).toBe(true);
  });

  it("propagates a DailyDigestBuilder failure", async () => {
    const publisher = createFakePublisher();
    const events = new MetaAdsAgentEvents(publisher);
    const service = new DigestService(events);
    const plan = unwrap(
      ExecutionPlan.create({
        id: ExecutionPlanId.generate(),
        tenantId: "dss-motor",
        decisions: [],
        generatedAt: new Date(),
      }),
    );

    const result = await service.generate(
      {
        tenantId: "",
        date: new Date(),
        targetHotLeads: 50,
        budgetAllocationIDR: 30_000_000,
        progress: buildObjectiveProgressFixture(),
        plan,
        creativeBriefs: [],
        escalations: [],
        adFindings: [],
      },
      "corr-1",
    );
    expect(result.ok).toBe(false);
    expect(publisher.published).toHaveLength(0);
  });
});
