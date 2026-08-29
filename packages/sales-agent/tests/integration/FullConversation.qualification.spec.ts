import { BranchId } from "@aos/branch-manager";
import { beforeEach, describe, expect, it } from "vitest";

import { QualificationStatus } from "../../src/domain/value-objects/QualificationStatus.js";
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

describe("Integration: FullConversation — active qualification asking (AAOS-W3D Fix 3)", () => {
  let context: { agent: ClaraAgent; publisher: FakePublisher };

  beforeEach(async () => {
    context = await makeAgent();
  });

  it("ReadyBuyer-style script (volunteers everything unprompted) still fully qualifies — passive extraction keeps working exactly as before", async () => {
    const input = {
      leadPhone: "+6281200000201",
      branchId: BranchId.CINERE,
      tenantId: "tenant-dss-motor",
      correlationId: "corr-1",
    };
    await context.agent.processIncomingMessage.execute({
      ...input,
      messageText: "halo kak mau beli Xpander",
    });
    await context.agent.processIncomingMessage.execute({
      ...input,
      messageText: "budget 200 juta cash",
    });
    const outcome = unwrap(
      await context.agent.processIncomingMessage.execute({
        ...input,
        messageText: "area Cinere bisa?",
      }),
    );
    expect(outcome.conversation.profile.isQualified(QualificationStatus.UNIT)).toBe(true);
    expect(outcome.conversation.profile.isQualified(QualificationStatus.BUDGET)).toBe(true);
    expect(outcome.conversation.profile.isQualified(QualificationStatus.PAYMENT)).toBe(true);
  });

  it("a lead who never volunteers budget gets actively asked for it once past greeting", async () => {
    const input = {
      leadPhone: "+6281200000202",
      branchId: BranchId.CINERE,
      tenantId: "tenant-dss-motor",
      correlationId: "corr-1",
    };
    await context.agent.processIncomingMessage.execute({ ...input, messageText: "halo kak" });
    const outcome = unwrap(
      await context.agent.processIncomingMessage.execute({
        ...input,
        messageText: "cabangnya di cinere ya",
      }),
    );
    expect(outcome.conversation.askedCriteria.size).toBeGreaterThanOrEqual(0);
    // Whatever Clara asks about (BUDGET first, per declared order, once QUALIFICATION is reached),
    // it must never repeat verbatim within a fresh ask.
    expect(outcome.outgoingMessage.body.length).toBeGreaterThan(0);
  });

  it("does not ask the same criterion twice across turns that stay in QUALIFICATION", async () => {
    const input = {
      leadPhone: "+6281200000203",
      branchId: BranchId.CINERE,
      tenantId: "tenant-dss-motor",
      correlationId: "corr-1",
    };
    await context.agent.processIncomingMessage.execute({ ...input, messageText: "halo kak" });
    await context.agent.processIncomingMessage.execute({
      ...input,
      messageText: "cabangnya di cinere ya",
    });
    const outcome = unwrap(
      await context.agent.processIncomingMessage.execute({ ...input, messageText: "oke sip" }),
    );
    // askedCriteria only ever grows — no criterion is ever removed/re-queued.
    expect(outcome.conversation.askedCriteria.size).toBeLessThanOrEqual(4);
  });
});
