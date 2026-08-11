import { BranchId } from "@aos/branch-manager";
import { describe, expect, it } from "vitest";

import { JessyAgentFactory } from "../../../src/factories/JessyAgentFactory.js";
import {
  fixedClock,
  makeRealBranchManager,
  makeRealSyncedInventoryQueryService,
  makeSalesAgentConfig,
} from "../../fixtures/salesAgentFixtures.js";
import { createFakePublisher } from "../../helpers/publisher.js";

describe("JessyAgentFactory", () => {
  it("wires every use case, service, and the branch-scoped agent identity", async () => {
    const publisher = createFakePublisher();
    const branchManager = makeRealBranchManager(publisher);
    const inventoryQueryService = await makeRealSyncedInventoryQueryService();
    const agent = JessyAgentFactory.create({
      config: makeSalesAgentConfig(),
      branchId: BranchId.BINTARO,
      publisher,
      assignLead: branchManager.assignLead,
      salesTeamRegistry: branchManager.salesTeamRegistry,
      inventoryQueryService,
      now: fixedClock(),
    });

    expect(agent.agent.name).toBe("Jessy");
    expect(agent.agent.branchId).toBe(BranchId.BINTARO);
    expect(agent.processIncomingMessage).toBeDefined();
    expect(agent.triggerHandoff).toBeDefined();
    expect(agent.scheduleFollowUp).toBeDefined();
    expect(agent.sendFollowUp).toBeDefined();
    expect(agent.getConversationState).toBeDefined();
    expect(agent.closeConversation).toBeDefined();
    expect(agent.jessyAgentService).toBeDefined();
    expect(agent.leadScoringService).toBeDefined();
    expect(agent.handoffService).toBeDefined();
    expect(agent.followUpService).toBeDefined();
  });

  it("defaults logger/tracer/clock when not supplied", async () => {
    const publisher = createFakePublisher();
    const branchManager = makeRealBranchManager(publisher);
    const inventoryQueryService = await makeRealSyncedInventoryQueryService();
    const agent = JessyAgentFactory.create({
      config: makeSalesAgentConfig(),
      branchId: BranchId.CINERE,
      publisher,
      assignLead: branchManager.assignLead,
      salesTeamRegistry: branchManager.salesTeamRegistry,
      inventoryQueryService,
    });
    expect(agent.agent.branchId).toBe(BranchId.CINERE);

    // Exercise the default (real wall-clock) `now` end-to-end, not just its construction.
    const outcome = await agent.processIncomingMessage.execute({
      leadPhone: "+6281200000001",
      branchId: BranchId.CINERE,
      messageText: "halo min",
      tenantId: "tenant-dss-motor",
      correlationId: "corr-1",
    });
    expect(outcome.ok).toBe(true);
  });
});
