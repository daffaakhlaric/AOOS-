import { describe, expect, it } from "vitest";

import { QueueService } from "../../../src/application/services/QueueService.js";
import { GetBranchStatus } from "../../../src/application/use-cases/GetBranchStatus.js";
import { BranchManagerEvents } from "../../../src/domain/events/BranchManagerEvents.js";
import { BranchId } from "../../../src/domain/value-objects/BranchId.js";
import { SalesStatus } from "../../../src/domain/value-objects/SalesStatus.js";
import { BranchRegistry } from "../../../src/registry/BranchRegistry.js";
import { SalesTeamRegistry } from "../../../src/registry/SalesTeamRegistry.js";
import { makeBranchConfig, makeSalesHuman } from "../../fixtures/branchManagerFixtures.js";
import { createFakeLogger } from "../../helpers/logger.js";
import { createFakePublisher } from "../../helpers/publisher.js";
import { unwrap, unwrapErr } from "../../helpers/result.js";

describe("GetBranchStatus", () => {
  it("returns full branch overview: team, queue size, today's stats", () => {
    const branchRegistry = new BranchRegistry([makeBranchConfig({ id: BranchId.BINTARO })]);
    const salesTeamRegistry = new SalesTeamRegistry();
    salesTeamRegistry.add(makeSalesHuman({ name: "A", status: SalesStatus.ON, todayLeadCount: 3 }));
    salesTeamRegistry.add(
      makeSalesHuman({ name: "B", status: SalesStatus.OFF, todayLeadCount: 2 }),
    );
    const events = new BranchManagerEvents(createFakePublisher());
    const queueService = new QueueService(100, 86_400_000, events, createFakeLogger());
    unwrap(queueService.enqueue({ leadId: "lead-1", branchId: BranchId.BINTARO }));

    const useCase = new GetBranchStatus(branchRegistry, salesTeamRegistry, queueService);
    const status = unwrap(useCase.execute({ branchId: BranchId.BINTARO }));
    expect(status.branch.id).toBe(BranchId.BINTARO);
    expect(status.team).toHaveLength(2);
    expect(status.availableCount).toBe(1);
    expect(status.queueSize).toBe(1);
    expect(status.todayAssignedCount).toBe(5);
  });

  it("fails with BranchNotFoundError for an unregistered branch", () => {
    const branchRegistry = new BranchRegistry([]);
    const salesTeamRegistry = new SalesTeamRegistry();
    const events = new BranchManagerEvents(createFakePublisher());
    const queueService = new QueueService(100, 86_400_000, events, createFakeLogger());
    const useCase = new GetBranchStatus(branchRegistry, salesTeamRegistry, queueService);
    expect(unwrapErr(useCase.execute({ branchId: BranchId.BINTARO })).message).toContain(
      "No branch registered",
    );
  });
});
