import { describe, expect, it } from "vitest";

import { SaveMessage } from "../../../src/application/use-cases/SaveMessage.js";
import { LeadStoreEvents } from "../../../src/domain/events/LeadStoreEvents.js";
import { ConversationRepository } from "../../../src/infrastructure/supabase/ConversationRepository.js";
import { LeadRepository } from "../../../src/infrastructure/supabase/LeadRepository.js";
import { MessageRepository } from "../../../src/infrastructure/supabase/MessageRepository.js";
import { makeConversationRow, makeLeadRow } from "../../fixtures/leadStoreFixtures.js";
import { createFakePublisher } from "../../helpers/publisher.js";
import { unwrap, unwrapErr } from "../../helpers/result.js";
import { createFakeSupabaseClient } from "../../helpers/supabase.js";

function setup() {
  const client = createFakeSupabaseClient();
  const leadRow = makeLeadRow();
  const conversationRow = makeConversationRow({ lead_id: leadRow.id });
  client.seed("leads", [leadRow]);
  client.seed("conversations", [conversationRow]);
  const messageRepository = new MessageRepository(client);
  const conversationRepository = new ConversationRepository(client);
  const leadRepository = new LeadRepository(client);
  const events = new LeadStoreEvents(createFakePublisher());
  const useCase = new SaveMessage(
    messageRepository,
    conversationRepository,
    leadRepository,
    events,
    () => new Date(),
  );
  return { client, useCase, conversationRow, leadRow };
}

const base = (conversationId: string, direction: "INCOMING" | "OUTGOING") => ({
  conversationId,
  direction,
  body: "hi",
  tenantId: "t1",
  correlationId: "c1",
});

describe("SaveMessage — d1/d2/d3/d5 exchange-milestone semantics (design resolution #1)", () => {
  it("message 1 in, 1 out -> d1=1 (1 exchange)", async () => {
    const { useCase, client, conversationRow } = setup();
    await useCase.execute(base(conversationRow.id, "INCOMING"));
    await useCase.execute(base(conversationRow.id, "OUTGOING"));
    const stored = client.rows("conversations")[0];
    expect(stored?.d1_count).toBe(1);
    expect(stored?.d2_count).toBe(0);
  });

  it("message 2 in, 2 out -> d2=1 (2 exchanges)", async () => {
    const { useCase, client, conversationRow } = setup();
    await useCase.execute(base(conversationRow.id, "INCOMING"));
    await useCase.execute(base(conversationRow.id, "OUTGOING"));
    await useCase.execute(base(conversationRow.id, "INCOMING"));
    await useCase.execute(base(conversationRow.id, "OUTGOING"));
    const stored = client.rows("conversations")[0];
    expect(stored?.d1_count).toBe(1);
    expect(stored?.d2_count).toBe(1);
    expect(stored?.d3_count).toBe(0);
  });

  it("message 3 in, 3 out -> d3=1 (3 exchanges = primary metric)", async () => {
    const { useCase, client, conversationRow } = setup();
    for (let i = 0; i < 3; i += 1) {
      await useCase.execute(base(conversationRow.id, "INCOMING"));
      await useCase.execute(base(conversationRow.id, "OUTGOING"));
    }
    const stored = client.rows("conversations")[0];
    expect(stored?.d1_count).toBe(1);
    expect(stored?.d2_count).toBe(1);
    expect(stored?.d3_count).toBe(1);
    expect(stored?.d5_count).toBe(0);
  });

  it("5 complete exchanges sets d5=1", async () => {
    const { useCase, client, conversationRow } = setup();
    for (let i = 0; i < 5; i += 1) {
      await useCase.execute(base(conversationRow.id, "INCOMING"));
      await useCase.execute(base(conversationRow.id, "OUTGOING"));
    }
    const stored = client.rows("conversations")[0];
    expect(stored?.d5_count).toBe(1);
  });

  it("an incoming message with no matching outgoing does NOT advance any milestone", async () => {
    const { useCase, client, conversationRow } = setup();
    await useCase.execute(base(conversationRow.id, "INCOMING"));
    await useCase.execute(base(conversationRow.id, "INCOMING"));
    const stored = client.rows("conversations")[0];
    expect(stored?.d1_count).toBe(0);
  });

  it("milestones are idempotent — reaching exchange 4 does not re-touch d3, exchange 6 does not re-touch d5", async () => {
    const { useCase, client, conversationRow } = setup();
    for (let i = 0; i < 6; i += 1) {
      await useCase.execute(base(conversationRow.id, "INCOMING"));
      await useCase.execute(base(conversationRow.id, "OUTGOING"));
    }
    const stored = client.rows("conversations")[0];
    expect(stored?.d1_count).toBe(1);
    expect(stored?.d2_count).toBe(1);
    expect(stored?.d3_count).toBe(1);
    expect(stored?.d5_count).toBe(1);
    expect(stored?.message_count).toBe(12);
  });
});

describe("SaveMessage — general behavior", () => {
  it("INCOMING message is saved and conversation.message_count is updated", async () => {
    const { useCase, client, conversationRow } = setup();
    const message = unwrap(await useCase.execute(base(conversationRow.id, "INCOMING")));
    expect(message.direction).toBe("INCOMING");
    expect(client.rows("messages")).toHaveLength(1);
    expect(client.rows("conversations")[0]?.message_count).toBe(1);
  });

  it("OUTGOING message is saved, conversation updated, and lead.last_message_at is set", async () => {
    const { useCase, client, conversationRow } = setup();
    await useCase.execute(base(conversationRow.id, "OUTGOING"));
    expect(client.rows("conversations")[0]?.message_count).toBe(1);
    expect(client.rows("leads")[0]?.last_message_at).not.toBeNull();
  });

  it("emits ConversationUpdated", async () => {
    const client = createFakeSupabaseClient();
    const leadRow = makeLeadRow();
    const conversationRow = makeConversationRow({ lead_id: leadRow.id });
    client.seed("leads", [leadRow]);
    client.seed("conversations", [conversationRow]);
    const publisher = createFakePublisher();
    const useCase = new SaveMessage(
      new MessageRepository(client),
      new ConversationRepository(client),
      new LeadRepository(client),
      new LeadStoreEvents(publisher),
      () => new Date(),
    );
    await useCase.execute(base(conversationRow.id, "INCOMING"));
    expect(publisher.published[0]).toMatchObject({ type: "aaos.lead-store.conversation.updated" });
  });

  it("returns ConversationNotFoundError for an unknown conversation", async () => {
    const { useCase } = setup();
    const error = unwrapErr(await useCase.execute(base("unknown-conv", "INCOMING")));
    expect(error.message).toContain("not found");
  });

  it("rejects an invalid direction", async () => {
    const { useCase, conversationRow } = setup();
    const error = unwrapErr(
      await useCase.execute({
        ...base(conversationRow.id, "INCOMING"),
        direction: "SIDEWAYS" as never,
      }),
    );
    expect(error.message).toContain("validation failed");
  });

  it("defaults messageType to TEXT when omitted", async () => {
    const { useCase, conversationRow } = setup();
    const message = unwrap(await useCase.execute(base(conversationRow.id, "INCOMING")));
    expect(message.messageType).toBe("TEXT");
  });

  it("rejects a whitespace-only conversationId (passes Zod's min(1), fails ConversationId.create's trim check)", async () => {
    const { useCase } = setup();
    const error = unwrapErr(await useCase.execute(base("   ", "INCOMING")));
    expect(error.message).toContain("ConversationId");
  });

  it("surfaces a repository error on the conversation lookup", async () => {
    const { useCase, client, conversationRow } = setup();
    client.forceErrorOnce("conversations", "connection reset");
    const error = unwrapErr(await useCase.execute(base(conversationRow.id, "INCOMING")));
    expect(error.message).toContain("connection reset");
  });

  it("surfaces a repository error on the message insert", async () => {
    const { useCase, client, conversationRow } = setup();
    client.forceErrorOnce("messages", "db error");
    const error = unwrapErr(await useCase.execute(base(conversationRow.id, "INCOMING")));
    expect(error.message).toContain("db error");
  });

  it("persists senderType/senderName for an OUTGOING message (AAOS-CHAT-ROOM-JESSY coordinator note #2)", async () => {
    const { useCase, client, conversationRow } = setup();
    await useCase.execute({
      ...base(conversationRow.id, "OUTGOING"),
      senderType: "SALES_HUMAN",
      senderName: "Ahmad Fauzi",
    });
    const stored = client.rows("messages")[0];
    expect(stored?.sender_type).toBe("SALES_HUMAN");
    expect(stored?.sender_name).toBe("Ahmad Fauzi");
  });

  it("leaves sender_type/sender_name null when omitted (e.g. an INCOMING message from the lead)", async () => {
    const { useCase, client, conversationRow } = setup();
    await useCase.execute(base(conversationRow.id, "INCOMING"));
    const stored = client.rows("messages")[0];
    expect(stored?.sender_type).toBeNull();
    expect(stored?.sender_name).toBeNull();
  });

  it("does not throw when the lead lookup for last_message_at fails silently", async () => {
    const { useCase, client, conversationRow } = setup();
    client.forceErrorOnce("leads", "transient error");
    const result = await useCase.execute(base(conversationRow.id, "INCOMING"));
    expect(result.ok).toBe(true); // message save still succeeds even if the lead touch-up fails
  });
});
