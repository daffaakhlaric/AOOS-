import { BranchId } from "@aos/branch-manager";
import { HttpResponse, http } from "msw";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { JessyAgentFactory } from "../../../src/factories/JessyAgentFactory.js";
import { CHAT_COMPLETIONS_PATH, OPENAI_BASE_URL } from "../../../src/llm/OpenAiChatClient.js";
import {
  fixedClock,
  makeRealBranchManager,
  makeRealSyncedInventoryQueryService,
  makeSalesAgentConfig,
} from "../../fixtures/salesAgentFixtures.js";
import { mswServer } from "../../helpers/msw.js";
import { createFakePublisher } from "../../helpers/publisher.js";

beforeAll(() => mswServer.listen({ onUnhandledRequest: "error" }));
afterEach(() => mswServer.resetHandlers());
afterAll(() => mswServer.close());

const CHAT_URL = `${OPENAI_BASE_URL}${CHAT_COMPLETIONS_PATH}`;

describe("JessyAgentFactory", () => {
  it("wires every use case, service, and the branch-scoped agent identity", async () => {
    const publisher = createFakePublisher();
    const branchManager = makeRealBranchManager(publisher);
    const inventoryQueryService = await makeRealSyncedInventoryQueryService();
    const agent = JessyAgentFactory.create({
      config: makeSalesAgentConfig(),
      branchId: BranchId.BINTARO,
      publisher,
      assignLead: branchManager.assignLead,
      salesTeamRegistry: branchManager.salesTeamRegistry,
      inventoryQueryService,
      now: fixedClock(),
    });

    expect(agent.agent.name).toBe("Jessy");
    expect(agent.agent.branchId).toBe(BranchId.BINTARO);
    expect(agent.processIncomingMessage).toBeDefined();
    expect(agent.triggerHandoff).toBeDefined();
    expect(agent.scheduleFollowUp).toBeDefined();
    expect(agent.sendFollowUp).toBeDefined();
    expect(agent.getConversationState).toBeDefined();
    expect(agent.closeConversation).toBeDefined();
    expect(agent.jessyAgentService).toBeDefined();
    expect(agent.leadScoringService).toBeDefined();
    expect(agent.handoffService).toBeDefined();
    expect(agent.followUpService).toBeDefined();
  });

  it("defaults logger/tracer/clock when not supplied", async () => {
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
    const agent = JessyAgentFactory.create({
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
    const agent = JessyAgentFactory.create({
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
    const agent = JessyAgentFactory.create({
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
