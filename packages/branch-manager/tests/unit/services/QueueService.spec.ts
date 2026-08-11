import { describe, expect, it, vi } from "vitest";

import { LeadAssignmentService } from "../../../src/application/services/LeadAssignmentService.js";
import { QueueService } from "../../../src/application/services/QueueService.js";
import type { IAssignmentStrategy } from "../../../src/contracts/IAssignmentStrategy.js";
import { BranchManagerEvents } from "../../../src/domain/events/BranchManagerEvents.js";
import { AssignmentMode } from "../../../src/domain/value-objects/AssignmentMode.js";
import { BranchId } from "../../../src/domain/value-objects/BranchId.js";
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

const T0 = new Date("2026-01-15T09:00:00.000Z");

function bareQueueService(maxQueueSize = 100, queueTtlMs = 86_400_000, at: Date = T0) {
  const publisher = createFakePublisher();
  const events = new BranchManagerEvents(publisher);
  const logger = createFakeLogger();
  const clock = { now: at };
  const queueService = new QueueService(maxQueueSize, queueTtlMs, events, logger, () => clock.now);
  return { queueService, publisher, events, clock, logger };
}

function fullSetup(assignmentMode: AssignmentMode, maxQueueSize = 100) {
  const branchRegistry = new BranchRegistry([makeBranchConfig({ assignmentMode })]);
  const salesTeamRegistry = new SalesTeamRegistry();
  const publisher = createFakePublisher();
  const events = new BranchManagerEvents(publisher);
  const now = fixedClock(T0);
  const queueService = new QueueService(maxQueueSize, 86_400_000, events, createFakeLogger(), now);
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
  return { queueService, salesTeamRegistry, publisher, leadAssignmentService };
}

describe("QueueService", () => {
  it("enqueue -> dequeue FIFO order", () => {
    const { queueService } = bareQueueService();
    unwrap(queueService.enqueue({ leadId: "lead-1", branchId: BranchId.BINTARO }));
    unwrap(queueService.enqueue({ leadId: "lead-2", branchId: BranchId.BINTARO }));
    expect(queueService.dequeue(BranchId.BINTARO)?.leadId).toBe("lead-1");
    expect(queueService.dequeue(BranchId.BINTARO)?.leadId).toBe("lead-2");
    expect(queueService.dequeue(BranchId.BINTARO)).toBeUndefined();
  });

  it("dequeue on a branch with no queue yet returns undefined", () => {
    const { queueService } = bareQueueService();
    expect(queueService.dequeue(BranchId.BANDUNG)).toBeUndefined();
  });

  it("getQueueSize / getBranchQueue / getAll reflect current state", () => {
    const { queueService } = bareQueueService();
    unwrap(queueService.enqueue({ leadId: "lead-1", branchId: BranchId.BINTARO }));
    unwrap(queueService.enqueue({ leadId: "lead-2", branchId: BranchId.CINERE }));
    expect(queueService.getQueueSize(BranchId.BINTARO)).toBe(1);
    expect(queueService.getBranchQueue(BranchId.BINTARO).map((l) => l.leadId)).toEqual(["lead-1"]);
    const all = queueService.getAll();
    expect(all.get(BranchId.BINTARO)?.map((l) => l.leadId)).toEqual(["lead-1"]);
    expect(all.get(BranchId.CINERE)?.map((l) => l.leadId)).toEqual(["lead-2"]);
  });

  it("getQueueSize for an untouched branch is 0", () => {
    const { queueService } = bareQueueService();
    expect(queueService.getQueueSize(BranchId.BANDUNG)).toBe(0);
  });

  it("maxQueueSize enforcement — enqueue fails once full", () => {
    const { queueService } = bareQueueService(1);
    unwrap(queueService.enqueue({ leadId: "lead-1", branchId: BranchId.BINTARO }));
    expect(
      unwrapErr(queueService.enqueue({ leadId: "lead-2", branchId: BranchId.BINTARO })).message,
    ).toContain("is full");
  });

  it("enqueue rejects an invalid lead (empty leadId)", () => {
    const { queueService } = bareQueueService();
    expect(
      unwrapErr(queueService.enqueue({ leadId: "", branchId: BranchId.BINTARO })).message,
    ).toContain("QueuedLead validation failed");
  });

  it("queue TTL expiry removes stale entries", () => {
    const { queueService, clock } = bareQueueService(100, 60_000, T0);
    unwrap(queueService.enqueue({ leadId: "stale", branchId: BranchId.BINTARO }));
    clock.now = new Date(T0.getTime() + 120_000);
    unwrap(queueService.enqueue({ leadId: "fresh", branchId: BranchId.BINTARO }));
    expect(queueService.getBranchQueue(BranchId.BINTARO).map((l) => l.leadId)).toEqual(["fresh"]);
  });

  it("flushBranch fails with AssignmentError before attachAssignmentService is called", async () => {
    const { queueService } = bareQueueService();
    const result = await queueService.flushBranch(BranchId.BINTARO, 2, {
      tenantId: "t1",
      correlationId: "c1",
    });
    expect(unwrapErr(result).message).toContain("attachAssignmentService");
  });

  it("flushBranch -> assigns up to capacity (pinned queue_flush: 3 queued, capacity=2 -> assigned=2, remaining=1)", async () => {
    const { queueService, salesTeamRegistry, publisher } = fullSetup(
      AssignmentMode.SMART_ASSIGN,
      100,
    );
    salesTeamRegistry.add(makeSalesHuman({ name: "A", maxLeadsPerDay: 50 }));

    unwrap(queueService.enqueue({ leadId: "lead1", branchId: BranchId.BINTARO }));
    unwrap(queueService.enqueue({ leadId: "lead2", branchId: BranchId.BINTARO }));
    unwrap(queueService.enqueue({ leadId: "lead3", branchId: BranchId.BINTARO }));

    const result = unwrap(
      await queueService.flushBranch(BranchId.BINTARO, 2, { tenantId: "t1", correlationId: "c1" }),
    );
    expect(result).toEqual({ assigned: 2, remaining: 1 });
    expect(queueService.getBranchQueue(BranchId.BINTARO).map((l) => l.leadId)).toEqual(["lead3"]);

    const flushedEvent = publisher.published.find((p) => p.type === "aaos.branch.queue.flushed");
    expect(flushedEvent?.payload).toMatchObject({ assigned: 2, remaining: 1 });
  });

  it("flushBranch on an empty queue assigns 0 and publishes QueueFlushed {assigned:0, remaining:0}", async () => {
    const { queueService, publisher } = fullSetup(AssignmentMode.SMART_ASSIGN);
    const result = unwrap(
      await queueService.flushBranch(BranchId.BINTARO, 5, { tenantId: "t1", correlationId: "c1" }),
    );
    expect(result).toEqual({ assigned: 0, remaining: 0 });
    const flushedEvent = publisher.published.find((p) => p.type === "aaos.branch.queue.flushed");
    expect(flushedEvent?.payload).toMatchObject({ assigned: 0, remaining: 0 });
  });

  it("flushBranch on a MANUAL-mode branch re-queues every dequeued lead (assigned stays 0)", async () => {
    const { queueService, salesTeamRegistry } = fullSetup(AssignmentMode.MANUAL);
    salesTeamRegistry.add(makeSalesHuman({ name: "A" }));
    unwrap(queueService.enqueue({ leadId: "lead1", branchId: BranchId.BINTARO }));
    unwrap(queueService.enqueue({ leadId: "lead2", branchId: BranchId.BINTARO }));

    const result = unwrap(
      await queueService.flushBranch(BranchId.BINTARO, 2, { tenantId: "t1", correlationId: "c1" }),
    );
    expect(result.assigned).toBe(0);
    expect(queueService.getQueueSize(BranchId.BINTARO)).toBe(2);
  });

  it("flushBranch with capacity 0 assigns nothing and leaves queue untouched", async () => {
    const { queueService, salesTeamRegistry } = fullSetup(AssignmentMode.SMART_ASSIGN);
    salesTeamRegistry.add(makeSalesHuman({ name: "A" }));
    unwrap(queueService.enqueue({ leadId: "lead1", branchId: BranchId.BINTARO }));

    const result = unwrap(
      await queueService.flushBranch(BranchId.BINTARO, 0, { tenantId: "t1", correlationId: "c1" }),
    );
    expect(result).toEqual({ assigned: 0, remaining: 1 });
  });

  it("logs a warning when enqueue rejects a full queue", () => {
    const publisher = createFakePublisher();
    const events = new BranchManagerEvents(publisher);
    const logger = createFakeLogger();
    const queueService = new QueueService(1, 86_400_000, events, logger, () => T0);
    unwrap(queueService.enqueue({ leadId: "lead-1", branchId: BranchId.BINTARO }));
    queueService.enqueue({ leadId: "lead-2", branchId: BranchId.BINTARO });
    expect(vi.mocked(logger.warn)).toHaveBeenCalled();
  });
});
