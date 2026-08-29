import { BranchId } from "@aos/branch-manager";
import { describe, expect, it } from "vitest";

import { ProcessIncomingMessage } from "../../../../src/application/use-cases/ProcessIncomingMessage.js";
import { ClaraAgentFactory } from "../../../../src/factories/ClaraAgentFactory.js";
import {
  fixedClock,
  makeRealBranchManager,
  makeRealSyncedInventoryQueryService,
  makeSalesAgentConfig,
} from "../../../fixtures/salesAgentFixtures.js";
import { createFakePublisher } from "../../../helpers/publisher.js";
import { unwrap } from "../../../helpers/result.js";

describe("ProcessIncomingMessage", () => {
  it("executes ClaraAgentService.processMessage inside a traced span", async () => {
    const publisher = createFakePublisher();
    const branchManager = makeRealBranchManager(publisher);
    const inventoryQueryService = await makeRealSyncedInventoryQueryService();
    const agent = ClaraAgentFactory.create({
      config: makeSalesAgentConfig(),
      branchId: BranchId.CINERE,
      publisher,
      assignLead: branchManager.assignLead,
      salesTeamRegistry: branchManager.salesTeamRegistry,
      inventoryQueryService,
      now: fixedClock(),
    });

    expect(agent.processIncomingMessage).toBeInstanceOf(ProcessIncomingMessage);

    const outcome = unwrap(
      await agent.processIncomingMessage.execute({
        leadPhone: "+6281200000001",
        branchId: BranchId.CINERE,
        messageText: "halo min",
        tenantId: "tenant-dss-motor",
        correlationId: "corr-1",
      }),
    );
    expect(outcome.outgoingMessage.to.toString()).toBe("+6281200000001");
  });
});
