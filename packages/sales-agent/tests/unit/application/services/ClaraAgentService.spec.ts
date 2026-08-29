import { BranchId } from "@aos/branch-manager";
import { err } from "@aos/common";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ClaraAgentService } from "../../../../src/application/services/ClaraAgentService.js";
import { FollowUpService } from "../../../../src/application/services/FollowUpService.js";
import type { HandoffService } from "../../../../src/application/services/HandoffService.js";
import { LeadScoringService } from "../../../../src/application/services/LeadScoringService.js";
import { ConversationEngine } from "../../../../src/conversation/ConversationEngine.js";
import { ConversationPipeline } from "../../../../src/conversation/ConversationPipeline.js";
import { ResponseGenerator } from "../../../../src/conversation/ResponseGenerator.js";
import { HandoffError } from "../../../../src/domain/errors/HandoffError.js";
import { ClaraAgentEvents } from "../../../../src/domain/events/ClaraAgentEvents.js";
import { ConversationId } from "../../../../src/domain/value-objects/ConversationId.js";
import { ConversationStage } from "../../../../src/domain/value-objects/ConversationStage.js";
import { LeadTemperature } from "../../../../src/domain/value-objects/LeadTemperature.js";
import { ClaraAgentFactory, type ClaraAgent } from "../../../../src/factories/ClaraAgentFactory.js";
import { InventoryQuerier } from "../../../../src/intelligence/InventoryQuerier.js";
import { LeadScorer } from "../../../../src/scoring/LeadScorer.js";
import {
  fixedClock,
  makeRealBranchManager,
  makeRealSyncedInventoryQueryService,
  makeSalesAgentConfig,
} from "../../../fixtures/salesAgentFixtures.js";
import { createFakePublisher, type FakePublisher } from "../../../helpers/publisher.js";
import { unwrap, unwrapErr } from "../../../helpers/result.js";

async function makeClaraAgent(
  overrides: Parameters<typeof makeSalesAgentConfig>[0] = {},
): Promise<{ agent: ClaraAgent; publisher: FakePublisher }> {
  const publisher = createFakePublisher();
  const branchManager = makeRealBranchManager(publisher);
  const inventoryQueryService = await makeRealSyncedInventoryQueryService();
  const agent = ClaraAgentFactory.create({
    config: makeSalesAgentConfig(overrides),
    branchId: BranchId.CINERE,
    publisher,
    assignLead: branchManager.assignLead,
    salesTeamRegistry: branchManager.salesTeamRegistry,
    inventoryQueryService,
    now: fixedClock(),
  });
  return { agent, publisher };
}

describe("ClaraAgentService (via real ClaraAgentFactory wiring)", () => {
  let context: { agent: ClaraAgent; publisher: FakePublisher };

  beforeEach(async () => {
    context = await makeClaraAgent();
  });

  it("getOrStart() creates a new GREETING conversation on first contact", () => {
    const { conversation, isNew } = context.agent.claraAgentService.getOrStart(
      "+6281200000001",
      BranchId.CINERE,
    );
    expect(isNew).toBe(true);
    expect(conversation.stage).toBe(ConversationStage.GREETING);
  });

  it("getOrStart() returns the SAME conversation on the second call", () => {
    const first = context.agent.claraAgentService.getOrStart("+6281200000001", BranchId.CINERE);
    const second = context.agent.claraAgentService.getOrStart("+6281200000001", BranchId.CINERE);
    expect(second.isNew).toBe(false);
    expect(second.conversation.id.equals(first.conversation.id)).toBe(true);
  });

  it("processMessage() stages GREETING → HOT across a scoring conversation", async () => {
    const input = {
      leadPhone: "+6281200000001",
      branchId: BranchId.CINERE,
      tenantId: "tenant-dss-motor",
      correlationId: "corr-1",
    };
    const first = unwrap(
      await context.agent.claraAgentService.processMessage({ ...input, messageText: "halo min" }),
    );
    expect(first.conversation.stage).toBe(ConversationStage.GREETING);

    await context.agent.claraAgentService.processMessage({
      ...input,
      messageText: "budget 200 juta kak",
    });
    await context.agent.claraAgentService.processMessage({
      ...input,
      messageText: "ada xpander gak kak",
    });
    // Score after this 3rd scoring message: 25 (budget) + 25 (unit) + 25 (area) = 75 ≥ 65 (hot).
    const crossing = unwrap(
      await context.agent.claraAgentService.processMessage({
        ...input,
        messageText: "cabangnya dimana kak",
      }),
    );
    expect(crossing.becameHot).toBe(true);
    expect(crossing.conversation.stage).toBe(ConversationStage.HANDOFF);
    expect(crossing.temperature).toBe(LeadTemperature.HOT);
    expect(crossing.handoff).toBeDefined();
  });

  it("processMessage() emits ConversationStarted only on the first message", async () => {
    const input = {
      leadPhone: "+6281200000002",
      branchId: BranchId.CINERE,
      tenantId: "tenant-dss-motor",
      correlationId: "corr-1",
    };
    await context.agent.claraAgentService.processMessage({ ...input, messageText: "halo" });
    await context.agent.claraAgentService.processMessage({ ...input, messageText: "halo lagi" });
    const startedCount = context.publisher.published.filter(
      (p) => p.type === "aaos.sales.conversation.started",
    ).length;
    expect(startedCount).toBe(1);
  });

  it("processMessage() prepares an OutgoingMessage, never a real send", async () => {
    const outcome = unwrap(
      await context.agent.claraAgentService.processMessage({
        leadPhone: "+6281200000003",
        branchId: BranchId.CINERE,
        messageText: "halo min",
        tenantId: "tenant-dss-motor",
        correlationId: "corr-1",
      }),
    );
    expect(outcome.outgoingMessage.to.toString()).toBe("+6281200000003");
  });

  it("processMessage() schedules a follow-up for a COLD lead ('halo min' only)", async () => {
    await context.agent.claraAgentService.processMessage({
      leadPhone: "+6281200000004",
      branchId: BranchId.CINERE,
      messageText: "halo min",
      tenantId: "tenant-dss-motor",
      correlationId: "corr-1",
    });
    expect(
      context.publisher.published.some((p) => p.type === "aaos.sales.follow-up.scheduled"),
    ).toBe(true);
  });

  it("processMessage() does NOT schedule a follow-up once HOT", async () => {
    const input = {
      leadPhone: "+6281200000005",
      branchId: BranchId.CINERE,
      tenantId: "tenant-dss-motor",
      correlationId: "corr-1",
    };
    await context.agent.claraAgentService.processMessage({
      ...input,
      messageText: "budget 200 juta",
    });
    await context.agent.claraAgentService.processMessage({ ...input, messageText: "ada xpander" });
    await context.agent.claraAgentService.processMessage({
      ...input,
      messageText: "cabang bintaro",
    });
    await context.agent.claraAgentService.processMessage({ ...input, messageText: "mau kredit" });
    context.publisher.published.length = 0;
    await context.agent.claraAgentService.processMessage({ ...input, messageText: "oke siap" });
    expect(
      context.publisher.published.some((p) => p.type === "aaos.sales.follow-up.scheduled"),
    ).toBe(false);
  });

  it("does not schedule follow-ups when followUpEnabled is false", async () => {
    const { agent, publisher } = await makeClaraAgent({ followUpEnabled: false });
    await agent.claraAgentService.processMessage({
      leadPhone: "+6281200000006",
      branchId: BranchId.CINERE,
      messageText: "halo min",
      tenantId: "tenant-dss-motor",
      correlationId: "corr-1",
    });
    expect(publisher.published.some((p) => p.type === "aaos.sales.follow-up.scheduled")).toBe(
      false,
    );
  });

  it("get() finds a conversation by id", () => {
    const { conversation } = context.agent.claraAgentService.getOrStart(
      "+6281200000007",
      BranchId.CINERE,
    );
    expect(context.agent.claraAgentService.get(conversation.id).ok).toBe(true);
  });

  it("get() returns a ConversationError when the id is not found", () => {
    const unknownId = unwrap(ConversationId.create("never-started::+62810000000"));
    const result = context.agent.claraAgentService.get(unknownId);
    expect(result.ok).toBe(false);
  });

  it("close() returns a ConversationError when the id is not found", () => {
    const unknownId = unwrap(ConversationId.create("never-started::+62810000001"));
    const result = context.agent.claraAgentService.close(unknownId);
    expect(result.ok).toBe(false);
  });

  it("close() marks a conversation CLOSED", async () => {
    const { conversation } = context.agent.claraAgentService.getOrStart(
      "+6281200000008",
      BranchId.CINERE,
    );
    const closed = unwrap(context.agent.claraAgentService.close(conversation.id));
    expect(closed.stage).toBe(ConversationStage.CLOSED);
    expect(closed.closed).toBe(true);
  });

  it("processMessage() propagates a ConversationPipeline failure (empty message text)", async () => {
    const result = await context.agent.claraAgentService.processMessage({
      leadPhone: "+6281200000009",
      branchId: BranchId.CINERE,
      messageText: "",
      tenantId: "tenant-dss-motor",
      correlationId: "corr-1",
    });
    expect(unwrapErr(result).message).toContain("non-empty");
  });

  it("processMessage() returns an AgentError when preparing the outgoing message fails", async () => {
    const result = await context.agent.claraAgentService.processMessage({
      leadPhone: "0812-not-e164",
      branchId: BranchId.CINERE,
      messageText: "halo min",
      tenantId: "tenant-dss-motor",
      correlationId: "corr-1",
    });
    expect(unwrapErr(result).message).toContain("PhoneNumber");
  });

  it("processMessage() wraps a HandoffService failure as an AgentError", async () => {
    const publisher = createFakePublisher();
    const events = new ClaraAgentEvents(publisher);
    const inventoryQuerier = new InventoryQuerier(await makeRealSyncedInventoryQueryService());
    const engine = new ConversationEngine(
      inventoryQuerier,
      { warmThreshold: 31, hotThreshold: 65 },
      new ResponseGenerator(),
      () => "Sales Cinere",
    );
    const pipeline = new ConversationPipeline(new LeadScorer(), engine);
    const failingHandoffService = {
      handoff: vi.fn(async () => err(new HandoffError("branch-manager unavailable"))),
    } as unknown as HandoffService;
    const failingService = new ClaraAgentService(
      pipeline,
      new LeadScoringService(events, 65, fixedClock()),
      failingHandoffService,
      new FollowUpService(events, 21_600_000, fixedClock()),
      events,
      makeSalesAgentConfig(),
      fixedClock(),
    );
    const input = {
      leadPhone: "+6281200099999",
      branchId: BranchId.CINERE,
      tenantId: "tenant-dss-motor",
      correlationId: "corr-1",
    };
    await failingService.processMessage({ ...input, messageText: "budget 200 juta" });
    await failingService.processMessage({ ...input, messageText: "ada xpander" });
    const result = await failingService.processMessage({ ...input, messageText: "cabang bintaro" });
    expect(unwrapErr(result).message).toContain("branch-manager unavailable");
  });

  it("uses the real wall clock when no clock is injected", async () => {
    const publisher = createFakePublisher();
    const events = new ClaraAgentEvents(publisher);
    const inventoryQuerier = new InventoryQuerier(await makeRealSyncedInventoryQueryService());
    const engine = new ConversationEngine(
      inventoryQuerier,
      { warmThreshold: 31, hotThreshold: 65 },
      new ResponseGenerator(),
      () => "Sales Cinere",
    );
    const pipeline = new ConversationPipeline(new LeadScorer(), engine);
    const service = new ClaraAgentService(
      pipeline,
      new LeadScoringService(events, 65),
      context.agent.handoffService,
      new FollowUpService(events, 21_600_000),
      events,
      makeSalesAgentConfig(),
    );
    const result = await service.processMessage({
      leadPhone: "+6281200000010",
      branchId: BranchId.CINERE,
      messageText: "halo min",
      tenantId: "tenant-dss-motor",
      correlationId: "corr-1",
    });
    expect(result.ok).toBe(true);
  });
});
