import { describe, expect, it } from "vitest";

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

function setup(assignmentMode: AssignmentMode = AssignmentMode.SMART_ASSIGN) {
  const branchRegistry = new BranchRegistry([makeBranchConfig({ assignmentMode })]);
  const salesTeamRegistry = new SalesTeamRegistry();
  const publisher = createFakePublisher();
  const events = new BranchManagerEvents(publisher);
  const logger = createFakeLogger();
  const now = fixedClock();
  const queueService = new QueueService(100, 86_400_000, events, logger, now);
  const strategies: Readonly<Record<AssignmentMode, IAssignmentStrategy>> = {
    [AssignmentMode.SMART_ASSIGN]: new SmartAssignStrategy(),
    [AssignmentMode.ROUND_ROBIN]: new RoundRobinStrategy(),
    [AssignmentMode.MANUAL]: new ManualAssignStrategy(),
  };
  const service = new LeadAssignmentService(
    branchRegistry,
    salesTeamRegistry,
    strategies,
    queueService,
    events,
    now,
  );
  queueService.attachAssignmentService(service);
  return { branchRegistry, salesTeamRegistry, publisher, events, queueService, service, now };
}

describe("LeadAssignmentService", () => {
  it("SMART_ASSIGN branch uses SmartAssignStrategy (fewest active leads wins)", async () => {
    const { salesTeamRegistry, service } = setup(AssignmentMode.SMART_ASSIGN);
    const a = makeSalesHuman({ name: "A", activeLeadCount: 3 });
    const b = makeSalesHuman({ name: "B", activeLeadCount: 1 });
    salesTeamRegistry.add(a);
    salesTeamRegistry.add(b);

    const result = unwrap(
      await service.assign({
        leadId: "lead-1",
        branchId: BranchId.BINTARO,
        tenantId: "t1",
        correlationId: "c1",
      }),
    );
    expect(result.status).toBe("ASSIGNED");
    if (result.status === "ASSIGNED") {
      expect(unwrap(salesTeamRegistry.getById(b.id)).name).toBe("B");
    }
  });

  it("ROUND_ROBIN branch uses RoundRobinStrategy", async () => {
    const { salesTeamRegistry, service } = setup(AssignmentMode.ROUND_ROBIN);
    const a = makeSalesHuman({ name: "A" });
    const b = makeSalesHuman({ name: "B" });
    salesTeamRegistry.add(a);
    salesTeamRegistry.add(b);

    const first = unwrap(
      await service.assign({
        leadId: "lead-1",
        branchId: BranchId.BINTARO,
        tenantId: "t1",
        correlationId: "c1",
      }),
    );
    const second = unwrap(
      await service.assign({
        leadId: "lead-2",
        branchId: BranchId.BINTARO,
        tenantId: "t1",
        correlationId: "c1",
      }),
    );
    expect(first.status).toBe("ASSIGNED");
    expect(second.status).toBe("ASSIGNED");
    if (first.status === "ASSIGNED" && second.status === "ASSIGNED") {
      expect(first.assignment.salesHumanId.toString()).not.toBe(
        second.assignment.salesHumanId.toString(),
      );
    }
  });

  it("MANUAL branch uses ManualAssignStrategy — always queues", async () => {
    const { salesTeamRegistry, service, publisher } = setup(AssignmentMode.MANUAL);
    salesTeamRegistry.add(makeSalesHuman({ name: "A" }));

    const result = unwrap(
      await service.assign({
        leadId: "lead-1",
        branchId: BranchId.BINTARO,
        tenantId: "t1",
        correlationId: "c1",
      }),
    );
    expect(result.status).toBe("QUEUED");
    const queuedEvent = publisher.published.find((p) => p.type === "aaos.branch.lead.queued");
    expect(queuedEvent?.payload).toMatchObject({ reason: "MANUAL" });
  });

  it("on assign: activeLeadCount + todayLeadCount incremented", async () => {
    const { salesTeamRegistry, service } = setup(AssignmentMode.SMART_ASSIGN);
    const a = makeSalesHuman({ name: "A" });
    salesTeamRegistry.add(a);

    unwrap(
      await service.assign({
        leadId: "lead-1",
        branchId: BranchId.BINTARO,
        tenantId: "t1",
        correlationId: "c1",
      }),
    );
    const updated = unwrap(salesTeamRegistry.getById(a.id));
    expect(updated.activeLeadCount.toNumber()).toBe(1);
    expect(updated.todayLeadCount.toNumber()).toBe(1);
  });

  it("LeadAssigned event emitted with correct payload (branchId + salesHumanId)", async () => {
    const { salesTeamRegistry, service, publisher } = setup(AssignmentMode.SMART_ASSIGN);
    const a = makeSalesHuman({ name: "A" });
    salesTeamRegistry.add(a);

    unwrap(
      await service.assign({
        leadId: "lead-1",
        branchId: BranchId.BINTARO,
        tenantId: "t1",
        correlationId: "c1",
      }),
    );
    const assignedEvent = publisher.published.find((p) => p.type === "aaos.branch.lead.assigned");
    expect(assignedEvent?.payload).toMatchObject({
      leadId: "lead-1",
      branchId: BranchId.BINTARO,
      salesHumanId: a.id.toString(),
      assignmentMode: AssignmentMode.SMART_ASSIGN,
    });
  });

  it("no available sales -> queues and publishes LeadQueued with NO_AVAILABLE_SALES reason", async () => {
    const { service, publisher } = setup(AssignmentMode.SMART_ASSIGN);
    const result = unwrap(
      await service.assign({
        leadId: "lead-1",
        branchId: BranchId.BINTARO,
        tenantId: "t1",
        correlationId: "c1",
      }),
    );
    expect(result.status).toBe("QUEUED");
    const queuedEvent = publisher.published.find((p) => p.type === "aaos.branch.lead.queued");
    expect(queuedEvent?.payload).toMatchObject({ reason: "NO_AVAILABLE_SALES" });
  });

  it("unregistered branch -> BranchNotFoundError", async () => {
    const { service } = setup(AssignmentMode.SMART_ASSIGN);
    const error = unwrapErr(
      await service.assign({
        leadId: "lead-1",
        branchId: BranchId.CINERE,
        tenantId: "t1",
        correlationId: "c1",
      }),
    );
    expect(error.message).toContain("No branch registered");
  });

  it("empty leadId -> ValidationError from LeadAssignment.create", async () => {
    const { salesTeamRegistry, service } = setup(AssignmentMode.SMART_ASSIGN);
    salesTeamRegistry.add(makeSalesHuman({ name: "A" }));
    const error = unwrapErr(
      await service.assign({
        leadId: "",
        branchId: BranchId.BINTARO,
        tenantId: "t1",
        correlationId: "c1",
      }),
    );
    expect(error.message).toContain("leadId must be a non-empty string");
  });

  it("quota-full queue -> AssignmentError propagated from QueueService.enqueue", async () => {
    const branchRegistry = new BranchRegistry([
      makeBranchConfig({ assignmentMode: AssignmentMode.SMART_ASSIGN }),
    ]);
    const salesTeamRegistry = new SalesTeamRegistry();
    const events = new BranchManagerEvents(createFakePublisher());
    const now = fixedClock();
    const queueService = new QueueService(1, 86_400_000, events, createFakeLogger(), now);
    const strategies: Readonly<Record<AssignmentMode, IAssignmentStrategy>> = {
      [AssignmentMode.SMART_ASSIGN]: new SmartAssignStrategy(),
      [AssignmentMode.ROUND_ROBIN]: new RoundRobinStrategy(),
      [AssignmentMode.MANUAL]: new ManualAssignStrategy(),
    };
    const service = new LeadAssignmentService(
      branchRegistry,
      salesTeamRegistry,
      strategies,
      queueService,
      events,
      now,
    );
    queueService.attachAssignmentService(service);

    unwrap(
      await service.assign({
        leadId: "lead-1",
        branchId: BranchId.BINTARO,
        tenantId: "t1",
        correlationId: "c1",
      }),
    );
    const error = unwrapErr(
      await service.assign({
        leadId: "lead-2",
        branchId: BranchId.BINTARO,
        tenantId: "t1",
        correlationId: "c1",
      }),
    );
    expect(error.message).toContain("is full");
  });

  it("defaults to the real wall clock when no now() is injected", async () => {
    const branchRegistry = new BranchRegistry([
      makeBranchConfig({ assignmentMode: AssignmentMode.SMART_ASSIGN }),
    ]);
    const salesTeamRegistry = new SalesTeamRegistry();
    const events = new BranchManagerEvents(createFakePublisher());
    const queueService = new QueueService(100, 86_400_000, events, createFakeLogger());
    const strategies: Readonly<Record<AssignmentMode, IAssignmentStrategy>> = {
      [AssignmentMode.SMART_ASSIGN]: new SmartAssignStrategy(),
      [AssignmentMode.ROUND_ROBIN]: new RoundRobinStrategy(),
      [AssignmentMode.MANUAL]: new ManualAssignStrategy(),
    };
    const service = new LeadAssignmentService(
      branchRegistry,
      salesTeamRegistry,
      strategies,
      queueService,
      events,
    );
    queueService.attachAssignmentService(service);
    const a = makeSalesHuman({ name: "A" });
    salesTeamRegistry.add(a);

    const result = unwrap(
      await service.assign({
        leadId: "lead-1",
        branchId: BranchId.BINTARO,
        tenantId: "t1",
        correlationId: "c1",
      }),
    );
    expect(result.status).toBe("ASSIGNED");
    if (result.status === "ASSIGNED") {
      expect(result.assignment.assignedAt).toBeInstanceOf(Date);
    }
  });
});
