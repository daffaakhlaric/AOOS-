import { describe, expect, it } from "vitest";

import { LeadAssignmentService } from "../../../src/application/services/LeadAssignmentService.js";
import { QueueService } from "../../../src/application/services/QueueService.js";
import { AssignLead } from "../../../src/application/use-cases/AssignLead.js";
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
import { createFakeTracer } from "../../helpers/tracer.js";

describe("AssignLead use case", () => {
  it("delegates to LeadAssignmentService.assign inside a traced span", async () => {
    const branchRegistry = new BranchRegistry([
      makeBranchConfig({ assignmentMode: AssignmentMode.SMART_ASSIGN }),
    ]);
    const salesTeamRegistry = new SalesTeamRegistry();
    salesTeamRegistry.add(makeSalesHuman({ name: "A" }));
    const events = new BranchManagerEvents(createFakePublisher());
    const now = fixedClock();
    const queueService = new QueueService(100, 86_400_000, events, createFakeLogger(), now);
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

    const useCase = new AssignLead(service, createFakeTracer());
    const result = unwrap(
      await useCase.execute({
        leadId: "lead-1",
        branchId: BranchId.BINTARO,
        tenantId: "t1",
        correlationId: "c1",
      }),
    );
    expect(result.status).toBe("ASSIGNED");
  });
});
