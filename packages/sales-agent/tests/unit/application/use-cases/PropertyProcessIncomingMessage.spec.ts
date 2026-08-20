import { BranchId } from "@aos/branch-manager";
import { describe, expect, it } from "vitest";

import { PropertyProcessIncomingMessage } from "../../../../src/application/use-cases/PropertyProcessIncomingMessage.js";
import { JessyAgentFactory } from "../../../../src/factories/JessyAgentFactory.js";
import {
  fixedClock,
  makeListingQueryService,
  makeRealBranchManager,
  makeSalesAgentConfig,
} from "../../../fixtures/salesAgentFixtures.js";
import { createFakePublisher } from "../../../helpers/publisher.js";
import { unwrap } from "../../../helpers/result.js";

describe("PropertyProcessIncomingMessage", () => {
  it("executes PropertyJessyAgentService.processMessage inside a traced span", async () => {
    const publisher = createFakePublisher();
    const branchManager = makeRealBranchManager(publisher);
    const agent = JessyAgentFactory.createPropertyAgent({
      config: makeSalesAgentConfig(),
      branchId: BranchId.CINERE,
      publisher,
      assignLead: branchManager.assignLead,
      salesTeamRegistry: branchManager.salesTeamRegistry,
      listingQueryService: makeListingQueryService(),
      now: fixedClock(),
    });

    expect(agent.processIncomingMessage).toBeInstanceOf(PropertyProcessIncomingMessage);

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
