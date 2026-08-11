import { describe, expect, it } from "vitest";

import { LeadAssignmentService } from "../../../src/application/services/LeadAssignmentService.js";
import { QueueService } from "../../../src/application/services/QueueService.js";
import { FlushQueue } from "../../../src/application/use-cases/FlushQueue.js";
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
import { unwrap } from "../../helpers/result.js";

describe("FlushQueue use case", () => {
  it("computes capacity from currently-available sales and flushes accordingly", async () => {
    const branchRegistry = new BranchRegistry([
      makeBranchConfig({ assignmentMode: AssignmentMode.SMART_ASSIGN }),
    ]);
    const salesTeamRegistry = new SalesTeamRegistry();
    const events = new BranchManagerEvents(createFakePublisher());
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

    salesTeamRegistry.add(makeSalesHuman({ name: "A", maxLeadsPerDay: 2, todayLeadCount: 0 }));
    unwrap(queueService.enqueue({ leadId: "lead-1", branchId: BranchId.BINTARO }));
    unwrap(queueService.enqueue({ leadId: "lead-2", branchId: BranchId.BINTARO }));
    unwrap(queueService.enqueue({ leadId: "lead-3", branchId: BranchId.BINTARO }));

    const useCase = new FlushQueue(salesTeamRegistry, queueService);
    const result = unwrap(
      await useCase.execute({ branchId: BranchId.BINTARO, tenantId: "t1", correlationId: "c1" }),
    );
    expect(result).toEqual({ assigned: 2, remaining: 1 });
  });

  it("capacity is 0 when no sales are available -> nothing flushed", async () => {
    const events = new BranchManagerEvents(createFakePublisher());
    const now = fixedClock();
    const queueService = new QueueService(100, 86_400_000, events, createFakeLogger(), now);
    const branchRegistry = new BranchRegistry([makeBranchConfig()]);
    const salesTeamRegistry = new SalesTeamRegistry();
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
    unwrap(queueService.enqueue({ leadId: "lead-1", branchId: BranchId.BINTARO }));

    const useCase = new FlushQueue(salesTeamRegistry, queueService);
    const result = unwrap(
      await useCase.execute({ branchId: BranchId.BINTARO, tenantId: "t1", correlationId: "c1" }),
    );
    expect(result).toEqual({ assigned: 0, remaining: 1 });
  });
});
