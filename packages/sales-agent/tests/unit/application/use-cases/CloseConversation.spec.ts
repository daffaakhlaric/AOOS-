import { BranchId } from "@aos/branch-manager";
import { describe, expect, it } from "vitest";

import { CloseConversation } from "../../../../src/application/use-cases/CloseConversation.js";
import { JessyAgentEvents } from "../../../../src/domain/events/JessyAgentEvents.js";
import { ConversationId } from "../../../../src/domain/value-objects/ConversationId.js";
import { ConversationStage } from "../../../../src/domain/value-objects/ConversationStage.js";
import { JessyAgentFactory } from "../../../../src/factories/JessyAgentFactory.js";
import {
  fixedClock,
  makeRealBranchManager,
  makeRealSyncedInventoryQueryService,
  makeSalesAgentConfig,
} from "../../../fixtures/salesAgentFixtures.js";
import { createFakePublisher } from "../../../helpers/publisher.js";
import { unwrap } from "../../../helpers/result.js";

describe("CloseConversation", () => {
  it("closes a conversation and emits ConversationClosed", async () => {
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
    expect(agent.closeConversation).toBeInstanceOf(CloseConversation);
    const { conversation } = agent.jessyAgentService.getOrStart("+6281200000001", BranchId.CINERE);
    const closed = unwrap(
      await agent.closeConversation.execute({
        conversationId: conversation.id,
        reason: "lead went cold",
        tenantId: "tenant-dss-motor",
        correlationId: "corr-1",
      }),
    );
    expect(closed.stage).toBe(ConversationStage.CLOSED);
    expect(publisher.published.some((p) => p.type === "aaos.sales.conversation.closed")).toBe(true);
  });

  it("returns an error when closing an unknown conversation", async () => {
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
    const unknownId = unwrap(ConversationId.create("never-started::+62810000099"));
    const result = await agent.closeConversation.execute({
      conversationId: unknownId,
      reason: "x",
      tenantId: "tenant-dss-motor",
      correlationId: "corr-1",
    });
    expect(result.ok).toBe(false);
  });

  it("uses the real wall clock when no clock is injected", async () => {
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
    const { conversation } = agent.jessyAgentService.getOrStart("+6281200000099", BranchId.CINERE);
    const useCase = new CloseConversation(agent.jessyAgentService, new JessyAgentEvents(publisher));
    const closed = unwrap(
      await useCase.execute({
        conversationId: conversation.id,
        reason: "x",
        tenantId: "tenant-dss-motor",
        correlationId: "corr-1",
      }),
    );
    expect(closed.stage).toBe(ConversationStage.CLOSED);
  });
});
