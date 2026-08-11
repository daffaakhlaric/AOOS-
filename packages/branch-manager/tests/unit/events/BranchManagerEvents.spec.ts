import { describe, expect, it } from "vitest";

import { BranchManagerEvents } from "../../../src/domain/events/BranchManagerEvents.js";
import { AssignmentMode } from "../../../src/domain/value-objects/AssignmentMode.js";
import { BranchId } from "../../../src/domain/value-objects/BranchId.js";
import { SalesStatus } from "../../../src/domain/value-objects/SalesStatus.js";
import { createFakePublisher } from "../../helpers/publisher.js";

const OCCURRED_AT = new Date("2026-01-15T09:00:00.000Z");

describe("BranchManagerEvents", () => {
  it("publishLeadAssigned wires the correct type/category/producer", async () => {
    const publisher = createFakePublisher();
    const events = new BranchManagerEvents(publisher);
    await events.publishLeadAssigned({
      assignmentId: "a1",
      leadId: "lead-1",
      branchId: BranchId.BINTARO,
      salesHumanId: "s1",
      assignmentMode: AssignmentMode.SMART_ASSIGN,
      tenantId: "t1",
      correlationId: "c1",
      occurredAt: OCCURRED_AT,
      version: "1.0",
    });
    expect(publisher.published).toHaveLength(1);
    expect(publisher.published[0]).toMatchObject({
      type: "aaos.branch.lead.assigned",
      source: "@aos/branch-manager",
      producer: "@aos/branch-manager",
      tenantId: "t1",
      correlationId: "c1",
      version: "1.0.0",
    });
  });

  it("publishLeadQueued wires the correct type", async () => {
    const publisher = createFakePublisher();
    const events = new BranchManagerEvents(publisher);
    await events.publishLeadQueued({
      leadId: "lead-1",
      branchId: BranchId.BINTARO,
      reason: "NO_AVAILABLE_SALES",
      queuePosition: 1,
      tenantId: "t1",
      correlationId: "c1",
      occurredAt: OCCURRED_AT,
      version: "1.0",
    });
    expect(publisher.published[0]?.type).toBe("aaos.branch.lead.queued");
  });

  it("publishSalesStatusChanged wires the correct type", async () => {
    const publisher = createFakePublisher();
    const events = new BranchManagerEvents(publisher);
    await events.publishSalesStatusChanged({
      salesHumanId: "s1",
      branchId: BranchId.BINTARO,
      previousStatus: SalesStatus.OFF,
      newStatus: SalesStatus.ON,
      tenantId: "t1",
      correlationId: "c1",
      occurredAt: OCCURRED_AT,
      version: "1.0",
    });
    expect(publisher.published[0]?.type).toBe("aaos.branch.sales.status-changed");
  });

  it("publishBranchConfigUpdated wires the correct type", async () => {
    const publisher = createFakePublisher();
    const events = new BranchManagerEvents(publisher);
    await events.publishBranchConfigUpdated({
      branchId: BranchId.BINTARO,
      assignmentMode: AssignmentMode.ROUND_ROBIN,
      tenantId: "t1",
      correlationId: "c1",
      occurredAt: OCCURRED_AT,
      version: "1.0",
    });
    expect(publisher.published[0]?.type).toBe("aaos.branch.config.updated");
  });

  it("publishQueueFlushed wires the correct type and pinned {assigned, remaining} shape", async () => {
    const publisher = createFakePublisher();
    const events = new BranchManagerEvents(publisher);
    await events.publishQueueFlushed({
      branchId: BranchId.BINTARO,
      assigned: 2,
      remaining: 1,
      tenantId: "t1",
      correlationId: "c1",
      occurredAt: OCCURRED_AT,
      version: "1.0",
    });
    expect(publisher.published[0]?.type).toBe("aaos.branch.queue.flushed");
    expect(publisher.published[0]?.payload).toMatchObject({ assigned: 2, remaining: 1 });
  });

  it("defaults source to @aos/branch-manager when not overridden", async () => {
    const publisher = createFakePublisher();
    const events = new BranchManagerEvents(publisher);
    await events.publishLeadQueued({
      leadId: "lead-1",
      branchId: BranchId.BINTARO,
      reason: "MANUAL",
      queuePosition: 1,
      tenantId: "t1",
      correlationId: "c1",
      occurredAt: OCCURRED_AT,
      version: "1.0",
    });
    expect(publisher.published[0]?.source).toBe("@aos/branch-manager");
  });
});
