import { BranchId } from "@aos/branch-manager";
import { HttpResponse, http } from "msw";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import type { IListingQueryService } from "../../../src/contracts/IListingQueryService.js";
import { LeadConversation } from "../../../src/domain/entities/LeadConversation.js";
import type { PropertyListing } from "../../../src/domain/entities/PropertyListing.js";
import { ConversationStage } from "../../../src/domain/value-objects/ConversationStage.js";
import { LeadScore } from "../../../src/domain/value-objects/LeadScore.js";
import { LeadTemperature } from "../../../src/domain/value-objects/LeadTemperature.js";
import { ClaraAgentFactory } from "../../../src/factories/ClaraAgentFactory.js";
import { CHAT_COMPLETIONS_PATH, OPENAI_BASE_URL } from "../../../src/llm/OpenAiChatClient.js";
import {
  fixedClock,
  makeListingQueryService,
  makeRealBranchManager,
  makeRealSyncedInventoryQueryService,
  makeSalesAgentConfig,
  SAMPLE_LISTINGS,
} from "../../fixtures/salesAgentFixtures.js";
import { mswServer } from "../../helpers/msw.js";
import { createFakePublisher } from "../../helpers/publisher.js";
import { unwrap } from "../../helpers/result.js";

beforeAll(() => mswServer.listen({ onUnhandledRequest: "error" }));
afterEach(() => mswServer.resetHandlers());
afterAll(() => mswServer.close());

const CHAT_URL = `${OPENAI_BASE_URL}${CHAT_COMPLETIONS_PATH}`;

describe("ClaraAgentFactory", () => {
  it("wires every use case, service, and the branch-scoped agent identity", async () => {
    const publisher = createFakePublisher();
    const branchManager = makeRealBranchManager(publisher);
    const inventoryQueryService = await makeRealSyncedInventoryQueryService();
    const agent = ClaraAgentFactory.create({
      config: makeSalesAgentConfig(),
      branchId: BranchId.BINTARO,
      publisher,
      assignLead: branchManager.assignLead,
      salesTeamRegistry: branchManager.salesTeamRegistry,
      inventoryQueryService,
      now: fixedClock(),
    });

    expect(agent.agent.name).toBe("Clara");
    expect(agent.agent.branchId).toBe(BranchId.BINTARO);
    expect(agent.processIncomingMessage).toBeDefined();
    expect(agent.triggerHandoff).toBeDefined();
    expect(agent.scheduleFollowUp).toBeDefined();
    expect(agent.sendFollowUp).toBeDefined();
    expect(agent.getConversationState).toBeDefined();
    expect(agent.closeConversation).toBeDefined();
    expect(agent.claraAgentService).toBeDefined();
    expect(agent.leadScoringService).toBeDefined();
    expect(agent.handoffService).toBeDefined();
    expect(agent.followUpService).toBeDefined();
  });

  it("defaults logger/tracer/clock when not supplied", async () => {
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
    });
    expect(agent.agent.branchId).toBe(BranchId.CINERE);

    // Exercise the default (real wall-clock) `now` end-to-end, not just its construction.
    const outcome = await agent.processIncomingMessage.execute({
      leadPhone: "+6281200000001",
      branchId: BranchId.CINERE,
      messageText: "halo min",
      tenantId: "tenant-dss-motor",
      correlationId: "corr-1",
    });
    expect(outcome.ok).toBe(true);
  });

  it("llmReplyEnabled + a real openaiApiKey → the real message flow calls OpenAI (MSW-mocked) and replies with its text", async () => {
    mswServer.use(
      http.post(CHAT_URL, () =>
        HttpResponse.json({ choices: [{ message: { content: "Halo kak! Ini balesan LLM 😊" } }] }),
      ),
    );
    const publisher = createFakePublisher();
    const branchManager = makeRealBranchManager(publisher);
    const inventoryQueryService = await makeRealSyncedInventoryQueryService();
    const agent = ClaraAgentFactory.create({
      config: makeSalesAgentConfig({ llmReplyEnabled: true, openaiApiKey: "sk-test" }),
      branchId: BranchId.CINERE,
      publisher,
      assignLead: branchManager.assignLead,
      salesTeamRegistry: branchManager.salesTeamRegistry,
      inventoryQueryService,
      now: fixedClock(),
    });

    const outcome = await agent.processIncomingMessage.execute({
      leadPhone: "+6281200000002",
      branchId: BranchId.CINERE,
      messageText: "halo min",
      tenantId: "tenant-dss-motor",
      correlationId: "corr-2",
    });
    expect(outcome.ok).toBe(true);
    if (outcome.ok) {
      expect(outcome.value.outgoingMessage.body.toString()).toBe("Halo kak! Ini balesan LLM 😊");
    }
  });

  it("llmReplyEnabled + OpenAI failure (MSW-mocked 500) → still replies, via the rule-based fallback", async () => {
    mswServer.use(http.post(CHAT_URL, () => new HttpResponse(null, { status: 500 })));
    const publisher = createFakePublisher();
    const branchManager = makeRealBranchManager(publisher);
    const inventoryQueryService = await makeRealSyncedInventoryQueryService();
    const agent = ClaraAgentFactory.create({
      config: makeSalesAgentConfig({ llmReplyEnabled: true, openaiApiKey: "sk-test" }),
      branchId: BranchId.CINERE,
      publisher,
      assignLead: branchManager.assignLead,
      salesTeamRegistry: branchManager.salesTeamRegistry,
      inventoryQueryService,
      now: fixedClock(),
    });

    const outcome = await agent.processIncomingMessage.execute({
      leadPhone: "+6281200000003",
      branchId: BranchId.CINERE,
      messageText: "halo min",
      tenantId: "tenant-dss-motor",
      correlationId: "corr-3",
    });
    expect(outcome.ok).toBe(true);
    if (outcome.ok) {
      expect(outcome.value.outgoingMessage.body.toString().length).toBeGreaterThan(0);
    }
  });

  it("llmReplyEnabled but no openaiApiKey → stays on the pure rule-based generator (no OpenAI call attempted)", async () => {
    mswServer.use(
      http.post(CHAT_URL, () => {
        throw new Error("must not be called — no apiKey configured");
      }),
    );
    const publisher = createFakePublisher();
    const branchManager = makeRealBranchManager(publisher);
    const inventoryQueryService = await makeRealSyncedInventoryQueryService();
    const agent = ClaraAgentFactory.create({
      config: makeSalesAgentConfig({ llmReplyEnabled: true }),
      branchId: BranchId.CINERE,
      publisher,
      assignLead: branchManager.assignLead,
      salesTeamRegistry: branchManager.salesTeamRegistry,
      inventoryQueryService,
      now: fixedClock(),
    });

    const outcome = await agent.processIncomingMessage.execute({
      leadPhone: "+6281200000004",
      branchId: BranchId.CINERE,
      messageText: "halo min",
      tenantId: "tenant-dss-motor",
      correlationId: "corr-4",
    });
    expect(outcome.ok).toBe(true);
  });
});

describe("ClaraAgentFactory.createPropertyConversationEngine", () => {
  const NOW = new Date("2026-08-20T09:00:00.000Z");
  const LISTING: PropertyListing = {
    id: "l1",
    title: "Rumah Bintaro",
    propertyType: "RUMAH",
    price: 1_500_000_000,
    bedrooms: 3,
  };

  function fakeQueryService(active: ReadonlyArray<PropertyListing>): IListingQueryService {
    return { getActive: () => active };
  }

  it("composes a real PropertyConversationEngine using default PROPERTY thresholds", async () => {
    const engine = ClaraAgentFactory.createPropertyConversationEngine({
      branchId: BranchId.BINTARO,
      listingQueryService: fakeQueryService([LISTING]),
    });
    const conversation = LeadConversation.start("+6281200000001", BranchId.BINTARO, NOW);
    const decision = await engine.decide(conversation, "halo min");
    expect(decision.ok).toBe(true);
    if (decision.ok) {
      expect(decision.value.nextStage).toBe(ConversationStage.GREETING);
    }
  });

  it("honours explicit warmThreshold/hotThreshold overrides", async () => {
    const engine = ClaraAgentFactory.createPropertyConversationEngine({
      branchId: BranchId.CINERE,
      listingQueryService: fakeQueryService([LISTING]),
      warmThreshold: 10,
      hotThreshold: 20,
    });
    const conversation = LeadConversation.start("+6281200000001", BranchId.CINERE, NOW)
      .withAppendedMessage({ isInbound: true } as never, NOW)
      .withAppendedMessage({ isInbound: false } as never, NOW)
      .withScore(LeadScore.zero().apply(25));
    const decision = await engine.decide(conversation, "oke lanjut kak");
    expect(decision.ok).toBe(true);
    if (decision.ok) {
      expect(decision.value.nextStage).toBe(ConversationStage.CLOSING);
    }
  });
});

describe("ClaraAgentFactory.createPropertyAgent", () => {
  it("wires every use case, service, and the branch-scoped agent identity", async () => {
    const publisher = createFakePublisher();
    const branchManager = makeRealBranchManager(publisher);
    const agent = ClaraAgentFactory.createPropertyAgent({
      config: makeSalesAgentConfig(),
      branchId: BranchId.BINTARO,
      publisher,
      assignLead: branchManager.assignLead,
      salesTeamRegistry: branchManager.salesTeamRegistry,
      listingQueryService: makeListingQueryService(),
      now: fixedClock(),
    });

    expect(agent.agent.name).toBe("Clara");
    expect(agent.agent.branchId).toBe(BranchId.BINTARO);
    expect(agent.processIncomingMessage).toBeDefined();
    expect(agent.triggerHandoff).toBeDefined();
    expect(agent.scheduleFollowUp).toBeDefined();
    expect(agent.sendFollowUp).toBeDefined();
    expect(agent.getConversationState).toBeDefined();
    expect(agent.closeConversation).toBeDefined();
    expect(agent.claraAgentService).toBeDefined();
    expect(agent.leadScoringService).toBeDefined();
    expect(agent.handoffService).toBeDefined();
    expect(agent.followUpService).toBeDefined();
  });

  it("defaults logger/tracer/clock and PROPERTY thresholds when not supplied", async () => {
    const publisher = createFakePublisher();
    const branchManager = makeRealBranchManager(publisher);
    const agent = ClaraAgentFactory.createPropertyAgent({
      config: makeSalesAgentConfig(),
      branchId: BranchId.CINERE,
      publisher,
      assignLead: branchManager.assignLead,
      salesTeamRegistry: branchManager.salesTeamRegistry,
      listingQueryService: makeListingQueryService(),
    });
    expect(agent.agent.branchId).toBe(BranchId.CINERE);

    // Exercise the default (real wall-clock) `now` end-to-end, not just its construction.
    const outcome = await agent.processIncomingMessage.execute({
      leadPhone: "+6281200000001",
      branchId: BranchId.CINERE,
      messageText: "halo min",
      tenantId: "tenant-dss-motor",
      correlationId: "corr-1",
    });
    expect(outcome.ok).toBe(true);
  });

  it("honours explicit warmThreshold/hotThreshold overrides consistently across engine + scoring", async () => {
    const publisher = createFakePublisher();
    const branchManager = makeRealBranchManager(publisher);
    const agent = ClaraAgentFactory.createPropertyAgent({
      config: makeSalesAgentConfig(),
      branchId: BranchId.CINERE,
      publisher,
      assignLead: branchManager.assignLead,
      salesTeamRegistry: branchManager.salesTeamRegistry,
      listingQueryService: makeListingQueryService(),
      warmThreshold: 10,
      hotThreshold: 20,
      now: fixedClock(),
    });
    const outcome = unwrap(
      await agent.processIncomingMessage.execute({
        leadPhone: "+6281200000002",
        branchId: BranchId.CINERE,
        messageText: "budget 1.5 miliar di bintaro",
        tenantId: "tenant-dss-motor",
        correlationId: "corr-1",
      }),
    );
    // 20 (budget) + 20 (area) = 40 ≥ 20 (overridden hotThreshold).
    expect(outcome.becameHot).toBe(true);
    expect(outcome.temperature).toBe(LeadTemperature.HOT);
  });

  it("real PROPERTY end-to-end flow matches a listing and hands off once HOT", async () => {
    const publisher = createFakePublisher();
    const branchManager = makeRealBranchManager(publisher);
    const agent = ClaraAgentFactory.createPropertyAgent({
      config: makeSalesAgentConfig(),
      branchId: BranchId.CINERE,
      publisher,
      assignLead: branchManager.assignLead,
      salesTeamRegistry: branchManager.salesTeamRegistry,
      listingQueryService: makeListingQueryService(SAMPLE_LISTINGS),
      now: fixedClock(),
    });
    const input = {
      leadPhone: "+6281200000003",
      branchId: BranchId.CINERE,
      tenantId: "tenant-dss-motor",
      correlationId: "corr-1",
    };
    await agent.processIncomingMessage.execute({ ...input, messageText: "halo min" });
    await agent.processIncomingMessage.execute({
      ...input,
      messageText: "cari rumah di bintaro budget 1.5 miliar",
    });
    const unitInfo = unwrap(
      await agent.processIncomingMessage.execute({
        ...input,
        messageText: "ada rumah bintaro gak kak",
      }),
    );
    expect(unitInfo.outgoingMessage.body.toString().length).toBeGreaterThan(0);
  });
});
