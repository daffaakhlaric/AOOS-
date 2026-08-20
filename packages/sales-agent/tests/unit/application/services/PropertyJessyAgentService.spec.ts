import { BranchId } from "@aos/branch-manager";
import { err } from "@aos/common";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { FollowUpService } from "../../../../src/application/services/FollowUpService.js";
import { PropertyHandoffService } from "../../../../src/application/services/PropertyHandoffService.js";
import type { PropertyHandoffService as PropertyHandoffServiceType } from "../../../../src/application/services/PropertyHandoffService.js";
import { PropertyJessyAgentService } from "../../../../src/application/services/PropertyJessyAgentService.js";
import { PropertyLeadScoringService } from "../../../../src/application/services/PropertyLeadScoringService.js";
import { PropertyConversationEngine } from "../../../../src/conversation/PropertyConversationEngine.js";
import { PropertyConversationPipeline } from "../../../../src/conversation/PropertyConversationPipeline.js";
import { PropertyResponseGenerator } from "../../../../src/conversation/PropertyResponseGenerator.js";
import { HandoffError } from "../../../../src/domain/errors/HandoffError.js";
import { JessyAgentEvents } from "../../../../src/domain/events/JessyAgentEvents.js";
import { ConversationId } from "../../../../src/domain/value-objects/ConversationId.js";
import { ConversationStage } from "../../../../src/domain/value-objects/ConversationStage.js";
import { LeadTemperature } from "../../../../src/domain/value-objects/LeadTemperature.js";
import {
  JessyAgentFactory,
  type PropertyJessyAgent,
} from "../../../../src/factories/JessyAgentFactory.js";
import { ListingQuerier } from "../../../../src/intelligence/ListingQuerier.js";
import { PropertyLeadScorer } from "../../../../src/scoring/PropertyLeadScorer.js";
import {
  fixedClock,
  makeListingQueryService,
  makeRealBranchManager,
  makeSalesAgentConfig,
} from "../../../fixtures/salesAgentFixtures.js";
import { createFakePublisher, type FakePublisher } from "../../../helpers/publisher.js";
import { unwrap, unwrapErr } from "../../../helpers/result.js";

async function makePropertyAgent(
  overrides: Parameters<typeof makeSalesAgentConfig>[0] = {},
): Promise<{ agent: PropertyJessyAgent; publisher: FakePublisher }> {
  const publisher = createFakePublisher();
  const branchManager = makeRealBranchManager(publisher);
  const agent = JessyAgentFactory.createPropertyAgent({
    config: makeSalesAgentConfig(overrides),
    branchId: BranchId.CINERE,
    publisher,
    assignLead: branchManager.assignLead,
    salesTeamRegistry: branchManager.salesTeamRegistry,
    listingQueryService: makeListingQueryService(),
    now: fixedClock(),
  });
  return { agent, publisher };
}

describe("PropertyJessyAgentService (via real JessyAgentFactory.createPropertyAgent wiring)", () => {
  let context: { agent: PropertyJessyAgent; publisher: FakePublisher };

  beforeEach(async () => {
    context = await makePropertyAgent();
  });

  it("getOrStart() creates a new GREETING conversation on first contact", () => {
    const { conversation, isNew } = context.agent.jessyAgentService.getOrStart(
      "+6281200000001",
      BranchId.CINERE,
    );
    expect(isNew).toBe(true);
    expect(conversation.stage).toBe(ConversationStage.GREETING);
  });

  it("getOrStart() returns the SAME conversation on the second call", () => {
    const first = context.agent.jessyAgentService.getOrStart("+6281200000001", BranchId.CINERE);
    const second = context.agent.jessyAgentService.getOrStart("+6281200000001", BranchId.CINERE);
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
      await context.agent.jessyAgentService.processMessage({ ...input, messageText: "halo min" }),
    );
    expect(first.conversation.stage).toBe(ConversationStage.GREETING);

    await context.agent.jessyAgentService.processMessage({
      ...input,
      messageText: "budget 1.5 miliar di bintaro",
    });
    await context.agent.jessyAgentService.processMessage({
      ...input,
      messageText: "cari rumah kak",
    });
    // Score after this 3rd scoring message: 20 (budget) + 20 (area) + 15 (type) + 15 (kpr) = 70 ≥ 65 (hot).
    const crossing = unwrap(
      await context.agent.jessyAgentService.processMessage({
        ...input,
        messageText: "kpr aja kak",
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
    await context.agent.jessyAgentService.processMessage({ ...input, messageText: "halo" });
    await context.agent.jessyAgentService.processMessage({ ...input, messageText: "halo lagi" });
    const startedCount = context.publisher.published.filter(
      (p) => p.type === "aaos.sales.conversation.started",
    ).length;
    expect(startedCount).toBe(1);
  });

  it("processMessage() prepares an OutgoingMessage, never a real send", async () => {
    const outcome = unwrap(
      await context.agent.jessyAgentService.processMessage({
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
    await context.agent.jessyAgentService.processMessage({
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

  it("does not schedule follow-ups when followUpEnabled is false", async () => {
    const { agent, publisher } = await makePropertyAgent({ followUpEnabled: false });
    await agent.jessyAgentService.processMessage({
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
    const { conversation } = context.agent.jessyAgentService.getOrStart(
      "+6281200000007",
      BranchId.CINERE,
    );
    expect(context.agent.jessyAgentService.get(conversation.id).ok).toBe(true);
  });

  it("get() returns a ConversationError when the id is not found", () => {
    const unknownId = unwrap(ConversationId.create("never-started::+62810000000"));
    const result = context.agent.jessyAgentService.get(unknownId);
    expect(result.ok).toBe(false);
  });

  it("close() marks a conversation CLOSED", async () => {
    const { conversation } = context.agent.jessyAgentService.getOrStart(
      "+6281200000008",
      BranchId.CINERE,
    );
    const closed = unwrap(context.agent.jessyAgentService.close(conversation.id));
    expect(closed.stage).toBe(ConversationStage.CLOSED);
    expect(closed.closed).toBe(true);
  });

  it("processMessage() propagates a PropertyConversationPipeline failure (empty message text)", async () => {
    const result = await context.agent.jessyAgentService.processMessage({
      leadPhone: "+6281200000009",
      branchId: BranchId.CINERE,
      messageText: "",
      tenantId: "tenant-dss-motor",
      correlationId: "corr-1",
    });
    expect(unwrapErr(result).message).toContain("non-empty");
  });

  it("processMessage() returns an AgentError when preparing the outgoing message fails", async () => {
    const result = await context.agent.jessyAgentService.processMessage({
      leadPhone: "0812-not-e164",
      branchId: BranchId.CINERE,
      messageText: "halo min",
      tenantId: "tenant-dss-motor",
      correlationId: "corr-1",
    });
    expect(unwrapErr(result).message).toContain("PhoneNumber");
  });

  it("processMessage() wraps a PropertyHandoffService failure as an AgentError", async () => {
    const publisher = createFakePublisher();
    const events = new JessyAgentEvents(publisher);
    const querier = new ListingQuerier(makeListingQueryService());
    const engine = new PropertyConversationEngine(
      querier,
      { warmThreshold: 30, hotThreshold: 65 },
      new PropertyResponseGenerator(),
      () => "Sales Cinere",
    );
    const pipeline = new PropertyConversationPipeline(new PropertyLeadScorer(), engine);
    const failingHandoffService = {
      handoff: vi.fn(async () => err(new HandoffError("branch-manager unavailable"))),
    } as unknown as PropertyHandoffServiceType;
    const failingService = new PropertyJessyAgentService(
      pipeline,
      new PropertyLeadScoringService(events, 65, fixedClock()),
      failingHandoffService,
      new FollowUpService(events, 21_600_000, fixedClock()),
      events,
      makeSalesAgentConfig({ warmThreshold: 30, hotThreshold: 65 }),
      fixedClock(),
    );
    const input = {
      leadPhone: "+6281200099999",
      branchId: BranchId.CINERE,
      tenantId: "tenant-dss-motor",
      correlationId: "corr-1",
    };
    await failingService.processMessage({
      ...input,
      messageText: "budget 1.5 miliar di bintaro",
    });
    await failingService.processMessage({ ...input, messageText: "cari rumah kak" });
    const result = await failingService.processMessage({
      ...input,
      messageText: "kpr aja kak",
    });
    expect(unwrapErr(result).message).toContain("branch-manager unavailable");
  });

  it("uses the real wall clock when no clock is injected", async () => {
    const publisher = createFakePublisher();
    const events = new JessyAgentEvents(publisher);
    const branchManager = makeRealBranchManager(publisher);
    const querier = new ListingQuerier(makeListingQueryService());
    const engine = new PropertyConversationEngine(
      querier,
      { warmThreshold: 30, hotThreshold: 65 },
      new PropertyResponseGenerator(),
      () => "Sales Cinere",
    );
    const pipeline = new PropertyConversationPipeline(new PropertyLeadScorer(), engine);
    const service = new PropertyJessyAgentService(
      pipeline,
      new PropertyLeadScoringService(events, 65),
      new PropertyHandoffService(branchManager.assignLead, branchManager.salesTeamRegistry, events),
      new FollowUpService(events, 21_600_000),
      events,
      makeSalesAgentConfig({ warmThreshold: 30, hotThreshold: 65 }),
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
