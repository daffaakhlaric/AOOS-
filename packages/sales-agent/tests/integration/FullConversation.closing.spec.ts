import { BranchId } from "@aos/branch-manager";
import { beforeEach, describe, expect, it } from "vitest";

import { ConversationStage } from "../../src/domain/value-objects/ConversationStage.js";
import { ClaraAgentFactory, type ClaraAgent } from "../../src/factories/ClaraAgentFactory.js";
import {
  fixedClock,
  makeRealBranchManager,
  makeRealSyncedInventoryQueryService,
  makeSalesAgentConfig,
} from "../fixtures/salesAgentFixtures.js";
import { createFakePublisher, type FakePublisher } from "../helpers/publisher.js";
import { unwrap } from "../helpers/result.js";

const CLOSING_INTENT_PATTERN = /test\s*drive|survei|survey|jadwal/i;

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

describe("Integration: FullConversation — closing (AAOS-W3D Fix 1)", () => {
  let context: { agent: ClaraAgent; publisher: FakePublisher };

  beforeEach(async () => {
    context = await makeAgent();
  });

  it("a WARM lead who exchanges 4+ turns without going HOT reaches CLOSING, mentioning test drive/survey/jadwal", async () => {
    const input = {
      leadPhone: "+6281200000101",
      branchId: BranchId.CINERE,
      tenantId: "tenant-dss-motor",
      correlationId: "corr-1",
    };
    await context.agent.processIncomingMessage.execute({ ...input, messageText: "halo kak" });
    await context.agent.processIncomingMessage.execute({
      ...input,
      messageText: "budget 100 juta kak",
    });
    await context.agent.processIncomingMessage.execute({
      ...input,
      messageText: "cabangnya di cinere ya",
    });
    const fourth = unwrap(
      await context.agent.processIncomingMessage.execute({ ...input, messageText: "oke sip" }),
    );
    expect(fourth.conversation.stage).toBe(ConversationStage.CLOSING);
    expect(fourth.outgoingMessage.body.toString().length).toBeLessThanOrEqual(150);
    expect(CLOSING_INTENT_PATTERN.test(fourth.outgoingMessage.body.toString())).toBe(true);
  });

  it("ColdBuyer-style lead ('halo min' only, never qualifies) never gets a CLOSING push", async () => {
    const input = {
      leadPhone: "+6281200000102",
      branchId: BranchId.CINERE,
      tenantId: "tenant-dss-motor",
      correlationId: "corr-1",
    };
    for (const text of ["halo min", "masih liat-liat aja", "belum pasti kapan", "nanti dulu ya"]) {
      const outcome = unwrap(
        await context.agent.processIncomingMessage.execute({ ...input, messageText: text }),
      );
      expect(outcome.conversation.stage).not.toBe(ConversationStage.CLOSING);
    }
  });

  it("a HOT lead's closing push (before the HANDOFF override) mentions test drive/survey/jadwal", async () => {
    const input = {
      leadPhone: "+6281200000103",
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
    expect(outcome.becameHot).toBe(true);
    expect(outcome.conversation.stage).toBe(ConversationStage.HANDOFF);
    // The reply actually sent this turn is the pipeline's CLOSING-stage response (the HANDOFF
    // stage override only touches the stored `conversation.stage`, not `outgoingMessage`) — see
    // `StageDetector`'s top-priority HOT rule and `ClaraAgentService.processMessage`.
    expect(CLOSING_INTENT_PATTERN.test(outcome.outgoingMessage.body.toString())).toBe(true);
  });
});
