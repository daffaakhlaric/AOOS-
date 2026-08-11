import { describe, expect, it } from "vitest";

import { MessageMapper } from "../../../src/infrastructure/mappers/MessageMapper.js";
import { MessageRepository } from "../../../src/infrastructure/supabase/MessageRepository.js";
import { makeMessageRow } from "../../fixtures/leadStoreFixtures.js";
import { unwrap, unwrapErr } from "../../helpers/result.js";
import { createFakeSupabaseClient } from "../../helpers/supabase.js";

describe("MessageRepository", () => {
  it("insert adds a new row and returns the mapped message", async () => {
    const client = createFakeSupabaseClient();
    const repo = new MessageRepository(client);
    const message = unwrap(MessageMapper.toDomain(makeMessageRow()));
    const inserted = unwrap(await repo.insert(message));
    expect(inserted.id.toString()).toBe(message.id.toString());
    expect(client.rows("messages")).toHaveLength(1);
  });

  it("insert surfaces 'no row returned' when the write resolves with no data", async () => {
    const client = createFakeSupabaseClient();
    client.forceNullOnce("messages");
    const repo = new MessageRepository(client);
    const message = unwrap(MessageMapper.toDomain(makeMessageRow()));
    const error = unwrapErr(await repo.insert(message));
    expect(error.message).toContain("no row returned");
  });

  it("insert surfaces a Supabase error", async () => {
    const client = createFakeSupabaseClient();
    client.forceErrorOnce("messages", "fk violation");
    const repo = new MessageRepository(client);
    const message = unwrap(MessageMapper.toDomain(makeMessageRow()));
    const error = unwrapErr(await repo.insert(message));
    expect(error.message).toContain("fk violation");
  });

  it("findByConversationId returns messages ordered by created_at ascending", async () => {
    const client = createFakeSupabaseClient();
    const conversationId = "conv-shared";
    client.seed("messages", [
      makeMessageRow({
        conversation_id: conversationId,
        created_at: "2026-01-15T09:02:00.000Z",
        body: "second",
      }),
      makeMessageRow({
        conversation_id: conversationId,
        created_at: "2026-01-15T09:00:00.000Z",
        body: "first",
      }),
      makeMessageRow({ conversation_id: "other-conv", body: "unrelated" }),
    ]);
    const repo = new MessageRepository(client);
    const message = unwrap(
      MessageMapper.toDomain(makeMessageRow({ conversation_id: conversationId })),
    );
    const result = unwrap(await repo.findByConversationId(message.conversationId));
    expect(result).toHaveLength(2);
    expect(result[0]?.body).toBe("first");
    expect(result[1]?.body).toBe("second");
  });

  it("findByConversationId surfaces a Supabase error", async () => {
    const client = createFakeSupabaseClient();
    client.forceErrorOnce("messages", "timeout");
    const repo = new MessageRepository(client);
    const message = unwrap(MessageMapper.toDomain(makeMessageRow()));
    const error = unwrapErr(await repo.findByConversationId(message.conversationId));
    expect(error.message).toContain("timeout");
  });

  it("findByConversationId propagates a mapping failure", async () => {
    const client = createFakeSupabaseClient();
    const conversationId = "conv-bad";
    client.seed("messages", [
      makeMessageRow({ conversation_id: conversationId, direction: "BOGUS" }),
    ]);
    const repo = new MessageRepository(client);
    const message = unwrap(
      MessageMapper.toDomain(makeMessageRow({ conversation_id: conversationId })),
    );
    const error = unwrapErr(await repo.findByConversationId(message.conversationId));
    expect(error.message).toContain("row mapping failed");
  });
});
