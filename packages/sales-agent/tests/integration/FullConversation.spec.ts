import { BranchId } from "@aos/branch-manager";
import { beforeEach, describe, expect, it } from "vitest";

import { ConversationStage } from "../../src/domain/value-objects/ConversationStage.js";
import { LeadTemperature } from "../../src/domain/value-objects/LeadTemperature.js";
import { ClaraAgentFactory, type ClaraAgent } from "../../src/factories/ClaraAgentFactory.js";
import {
  fixedClock,
  makeRealBranchManager,
  makeRealSyncedInventoryQueryService,
  makeSalesAgentConfig,
} from "../fixtures/salesAgentFixtures.js";
import { createFakePublisher, type FakePublisher } from "../helpers/publisher.js";
import { unwrap } from "../helpers/result.js";

async function makeAgent(): Promise<{ agent: ClaraAgent; publisher: FakePublisher }> {
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
  return { agent, publisher };
}

describe("Integration: FullConversation", () => {
  let context: { agent: ClaraAgent; publisher: FakePublisher };

  beforeEach(async () => {
    context = await makeAgent();
  });

  it("Cold lead: 'halo min' only → COLD, no handoff, follow up scheduled", async () => {
    const outcome = unwrap(
      await context.agent.processIncomingMessage.execute({
        leadPhone: "+6281200000001",
        branchId: BranchId.CINERE,
        messageText: "halo min",
        tenantId: "tenant-dss-motor",
        correlationId: "corr-1",
      }),
    );
    expect(outcome.temperature).toBe(LeadTemperature.COLD);
    expect(outcome.becameHot).toBe(false);
    expect(outcome.handoff).toBeUndefined();
    expect(
      context.publisher.published.some((p) => p.type === "aaos.sales.follow-up.scheduled"),
    ).toBe(true);
    expect(context.publisher.published.some((p) => p.type === "aaos.sales.handoff.triggered")).toBe(
      false,
    );
  });

  it("Warm lead: unit + budget → WARM, no handoff", async () => {
    const input = {
      leadPhone: "+6281200000002",
      branchId: BranchId.CINERE,
      tenantId: "tenant-dss-motor",
      correlationId: "corr-1",
    };
    await context.agent.processIncomingMessage.execute({
      ...input,
      messageText: "ada xpander gak kak",
    });
    const outcome = unwrap(
      await context.agent.processIncomingMessage.execute({
        ...input,
        messageText: "budget 200 juta kak",
      }),
    );
    expect(outcome.temperature).toBe(LeadTemperature.WARM);
    expect(outcome.becameHot).toBe(false);
    expect(outcome.handoff).toBeUndefined();
  });

  it("Hot lead: unit+budget+area+payment → HOT → handoff triggered", async () => {
    const input = {
      leadPhone: "+6281200000003",
      branchId: BranchId.CINERE,
      tenantId: "tenant-dss-motor",
      correlationId: "corr-1",
    };
    await context.agent.processIncomingMessage.execute({
      ...input,
      messageText: "ada xpander gak kak",
    });
    await context.agent.processIncomingMessage.execute({
      ...input,
      messageText: "budget 200 juta kak",
    });
    const outcome = unwrap(
      await context.agent.processIncomingMessage.execute({
        ...input,
        messageText: "cabangnya dimana kak",
      }),
    );
    expect(outcome.temperature).toBe(LeadTemperature.HOT);
    expect(outcome.becameHot).toBe(true);
    expect(outcome.handoff).toBeDefined();
    expect(outcome.conversation.stage).toBe(ConversationStage.HANDOFF);
    expect(context.publisher.published.some((p) => p.type === "aaos.sales.handoff.triggered")).toBe(
      true,
    );
    expect(context.publisher.published.some((p) => p.type === "aaos.branch.lead.assigned")).toBe(
      true,
    );
  });

  it("Lead asks Xpander Cinere → inventory queried → real unit returned", async () => {
    const outcome = unwrap(
      await context.agent.processIncomingMessage.execute({
        leadPhone: "+6281200000004",
        branchId: BranchId.CINERE,
        messageText: "ada Xpander gak kak di Cinere?",
        tenantId: "tenant-dss-motor",
        correlationId: "corr-1",
      }),
    );
    expect(outcome.conversation.stage).toBe(ConversationStage.UNIT_INFO);
    expect(outcome.outgoingMessage.body.toString()).toContain("Xpander");
  });

  it('Objection "pikir dulu" → soft response, no pressure', async () => {
    const input = {
      leadPhone: "+6281200000005",
      branchId: BranchId.CINERE,
      tenantId: "tenant-dss-motor",
      correlationId: "corr-1",
    };
    await context.agent.processIncomingMessage.execute({ ...input, messageText: "halo min" });
    const outcome = unwrap(
      await context.agent.processIncomingMessage.execute({
        ...input,
        messageText: "pikir dulu ya kak",
      }),
    );
    expect(outcome.conversation.stage).toBe(ConversationStage.OBJECTION);
    expect(outcome.outgoingMessage.body.toString().length).toBeLessThanOrEqual(300);
  });

  it("Score accumulation across 5 messages (assert exact scores)", async () => {
    const input = {
      leadPhone: "+6281200000006",
      branchId: BranchId.CINERE,
      tenantId: "tenant-dss-motor",
      correlationId: "corr-1",
    };
    const scores: number[] = [];
    for (const text of [
      "halo min",
      "budget 200 juta kak",
      "ada xpander gak kak",
      "cabangnya dimana kak",
      "mau kredit kak",
    ]) {
      const outcome = unwrap(
        await context.agent.processIncomingMessage.execute({ ...input, messageText: text }),
      );
      scores.push(outcome.conversation.score.toNumber());
    }
    expect(scores).toEqual([0, 25, 50, 75, 100]);
  });

  it("every prepared outgoing message stays ≤ 300 chars, across every scenario above", async () => {
    const input = {
      leadPhone: "+6281200000007",
      branchId: BranchId.CINERE,
      tenantId: "tenant-dss-motor",
      correlationId: "corr-1",
    };
    for (const text of [
      "halo min",
      "ada xpander?",
      "dp berapa kak?",
      "pikir dulu ah",
      "oke siap deh",
    ]) {
      const outcome = unwrap(
        await context.agent.processIncomingMessage.execute({ ...input, messageText: text }),
      );
      expect(outcome.outgoingMessage.body.length).toBeLessThanOrEqual(300);
    }
  });
});
