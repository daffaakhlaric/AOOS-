import { BranchId } from "@aos/branch-manager";
import { describe, expect, it } from "vitest";

import { PropertyGetConversationState } from "../../../../src/application/use-cases/PropertyGetConversationState.js";
import { ClaraAgentFactory } from "../../../../src/factories/ClaraAgentFactory.js";
import {
  fixedClock,
  makeListingQueryService,
  makeRealBranchManager,
  makeSalesAgentConfig,
} from "../../../fixtures/salesAgentFixtures.js";
import { createFakePublisher } from "../../../helpers/publisher.js";

describe("PropertyGetConversationState", () => {
  it("returns the conversation state for a started conversation", async () => {
    const publisher = createFakePublisher();
    const branchManager = makeRealBranchManager(publisher);
    const agent = ClaraAgentFactory.createPropertyAgent({
      config: makeSalesAgentConfig(),
      branchId: BranchId.CINERE,
      publisher,
      assignLead: branchManager.assignLead,
      salesTeamRegistry: branchManager.salesTeamRegistry,
      listingQueryService: makeListingQueryService(),
      now: fixedClock(),
    });
    expect(agent.getConversationState).toBeInstanceOf(PropertyGetConversationState);
    const { conversation } = agent.claraAgentService.getOrStart("+6281200000001", BranchId.CINERE);
    const result = agent.getConversationState.execute(conversation.id);
    expect(result.ok).toBe(true);
  });
});
