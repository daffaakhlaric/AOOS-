import { BranchId } from "@aos/branch-manager";
import { describe, expect, it } from "vitest";

import { GetConversationState } from "../../../../src/application/use-cases/GetConversationState.js";
import { JessyAgentFactory } from "../../../../src/factories/JessyAgentFactory.js";
import {
  fixedClock,
  makeRealBranchManager,
  makeRealSyncedInventoryQueryService,
  makeSalesAgentConfig,
} from "../../../fixtures/salesAgentFixtures.js";
import { createFakePublisher } from "../../../helpers/publisher.js";

describe("GetConversationState", () => {
  it("returns the conversation state for a started conversation", async () => {
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
      now: fixedClock(),
    });
    expect(agent.getConversationState).toBeInstanceOf(GetConversationState);
    const { conversation } = agent.jessyAgentService.getOrStart("+6281200000001", BranchId.CINERE);
    const result = agent.getConversationState.execute(conversation.id);
    expect(result.ok).toBe(true);
  });
});
