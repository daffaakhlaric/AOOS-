import { describe, expect, it } from "vitest";

import { AvailabilityService } from "../../../src/application/services/AvailabilityService.js";
import { LeadAssignmentService } from "../../../src/application/services/LeadAssignmentService.js";
import { QueueService } from "../../../src/application/services/QueueService.js";
import { FlushQueue } from "../../../src/application/use-cases/FlushQueue.js";
import { UpdateSalesStatus } from "../../../src/application/use-cases/UpdateSalesStatus.js";
import type { IAssignmentStrategy } from "../../../src/contracts/IAssignmentStrategy.js";
import { BranchManagerEvents } from "../../../src/domain/events/BranchManagerEvents.js";
import { AssignmentMode } from "../../../src/domain/value-objects/AssignmentMode.js";
import { BranchId } from "../../../src/domain/value-objects/BranchId.js";
import { SalesHumanId } from "../../../src/domain/value-objects/SalesHumanId.js";
import { SalesStatus } from "../../../src/domain/value-objects/SalesStatus.js";
import { ManualAssignStrategy } from "../../../src/intelligence/ManualAssignStrategy.js";
import { RoundRobinStrategy } from "../../../src/intelligence/RoundRobinStrategy.js";
import { SmartAssignStrategy } from "../../../src/intelligence/SmartAssignStrategy.js";
import { BranchRegistry } from "../../../src/registry/BranchRegistry.js";
import { SalesTeamRegistry } from "../../../src/registry/SalesTeamRegistry.js";
import {
  fixedClock,
  makeBranchConfig,
  makeSalesHuman,
} from "../../fixtures/branchManagerFixtures.js";
import { createFakeLogger } from "../../helpers/logger.js";
import { createFakePublisher } from "../../helpers/publisher.js";
import { unwrap, unwrapErr } from "../../helpers/result.js";

function setup() {
  const branchRegistry = new BranchRegistry([
    makeBranchConfig({ assignmentMode: AssignmentMode.SMART_ASSIGN }),
  ]);
  const salesTeamRegistry = new SalesTeamRegistry();
  const publisher = createFakePublisher();
  const events = new BranchManagerEvents(publisher);
  const now = fixedClock();
  const queueService = new QueueService(100, 86_400_000, events, createFakeLogger(), now);
  const strategies: Readonly<Record<AssignmentMode, IAssignmentStrategy>> = {
    [AssignmentMode.SMART_ASSIGN]: new SmartAssignStrategy(),
    [AssignmentMode.ROUND_ROBIN]: new RoundRobinStrategy(),
    [AssignmentMode.MANUAL]: new ManualAssignStrategy(),
  };
  const leadAssignmentService = new LeadAssignmentService(
    branchRegistry,
    salesTeamRegistry,
    strategies,
    queueService,
    events,
    now,
  );
  queueService.attachAssignmentService(leadAssignmentService);
  const availabilityService = new AvailabilityService(salesTeamRegistry, events, now);
  const flushQueue = new FlushQueue(salesTeamRegistry, queueService);
  const useCase = new UpdateSalesStatus(availabilityService, flushQueue);
  return { salesTeamRegistry, queueService, useCase, publisher };
}

describe("UpdateSalesStatus", () => {
  it("transitions status and publishes SalesStatusChanged", async () => {
    const { salesTeamRegistry, useCase, publisher } = setup();
    const a = makeSalesHuman({ name: "A", status: SalesStatus.ON });
    salesTeamRegistry.add(a);

    const result = unwrap(
      await useCase.execute({
        salesHumanId: a.id,
        status: SalesStatus.OFF,
        tenantId: "t1",
        correlationId: "c1",
      }),
    );
    expect(result.status).toBe(SalesStatus.OFF);
    expect(publisher.published.some((p) => p.type === "aaos.branch.sales.status-changed")).toBe(
      true,
    );
  });

  it("transitioning to ON auto-flushes the branch's queue", async () => {
    const { salesTeamRegistry, queueService, useCase, publisher } = setup();
    const a = makeSalesHuman({ name: "A", status: SalesStatus.OFF, maxLeadsPerDay: 5 });
    salesTeamRegistry.add(a);
    unwrap(queueService.enqueue({ leadId: "lead-1", branchId: BranchId.BINTARO }));

    unwrap(
      await useCase.execute({
        salesHumanId: a.id,
        status: SalesStatus.ON,
        tenantId: "t1",
        correlationId: "c1",
      }),
    );

    expect(queueService.getQueueSize(BranchId.BINTARO)).toBe(0);
    expect(publisher.published.some((p) => p.type === "aaos.branch.queue.flushed")).toBe(true);
  });

  it("transitioning ON -> BUSY does not trigger a flush", async () => {
    const { salesTeamRegistry, queueService, useCase, publisher } = setup();
    const a = makeSalesHuman({ name: "A", status: SalesStatus.ON });
    salesTeamRegistry.add(a);
    unwrap(queueService.enqueue({ leadId: "lead-1", branchId: BranchId.BINTARO }));

    unwrap(
      await useCase.execute({
        salesHumanId: a.id,
        status: SalesStatus.BUSY,
        tenantId: "t1",
        correlationId: "c1",
      }),
    );

    expect(queueService.getQueueSize(BranchId.BINTARO)).toBe(1);
    expect(publisher.published.some((p) => p.type === "aaos.branch.queue.flushed")).toBe(false);
  });

  it("fails with SalesHumanNotFoundError for an unregistered id", async () => {
    const { useCase } = setup();
    const error = unwrapErr(
      await useCase.execute({
        salesHumanId: SalesHumanId.generate(),
        status: SalesStatus.ON,
        tenantId: "t1",
        correlationId: "c1",
      }),
    );
    expect(error.message).toContain("No sales human registered");
  });
});
