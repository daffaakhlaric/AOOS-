import { describe, expect, it } from "vitest";

import { ConversationMapper } from "../../../src/infrastructure/mappers/ConversationMapper.js";
import { ConversationRepository } from "../../../src/infrastructure/supabase/ConversationRepository.js";
import { makeConversationRow } from "../../fixtures/leadStoreFixtures.js";
import { unwrap, unwrapErr } from "../../helpers/result.js";
import { createFakeSupabaseClient } from "../../helpers/supabase.js";

describe("ConversationRepository", () => {
  it("findById returns undefined when no row matches", async () => {
    const client = createFakeSupabaseClient();
    const repo = new ConversationRepository(client);
    const conversation = unwrap(ConversationMapper.toDomain(makeConversationRow()));
    const result = unwrap(await repo.findById(conversation.id));
    expect(result).toBeUndefined();
  });

  it("findById returns the mapped conversation when found", async () => {
    const client = createFakeSupabaseClient();
    const row = makeConversationRow();
    client.seed("conversations", [row]);
    const repo = new ConversationRepository(client);
    const conversation = unwrap(ConversationMapper.toDomain(row));
    const found = unwrap(await repo.findById(conversation.id));
    expect(found?.id.toString()).toBe(row.id);
  });

  it("findById surfaces a Supabase error", async () => {
    const client = createFakeSupabaseClient();
    client.forceErrorOnce("conversations", "timeout");
    const repo = new ConversationRepository(client);
    const conversation = unwrap(ConversationMapper.toDomain(makeConversationRow()));
    const error = unwrapErr(await repo.findById(conversation.id));
    expect(error.message).toContain("timeout");
  });

  it("findByLeadId returns the matching conversation", async () => {
    const client = createFakeSupabaseClient();
    const row = makeConversationRow();
    client.seed("conversations", [row]);
    const repo = new ConversationRepository(client);
    const conversation = unwrap(ConversationMapper.toDomain(row));
    const found = unwrap(await repo.findByLeadId(conversation.leadId));
    expect(found?.leadId.toString()).toBe(row.lead_id);
  });

  it("findByLeadId returns undefined when no match", async () => {
    const client = createFakeSupabaseClient();
    const repo = new ConversationRepository(client);
    const conversation = unwrap(ConversationMapper.toDomain(makeConversationRow()));
    const result = unwrap(await repo.findByLeadId(conversation.leadId));
    expect(result).toBeUndefined();
  });

  it("insert adds a new row", async () => {
    const client = createFakeSupabaseClient();
    const repo = new ConversationRepository(client);
    const conversation = unwrap(ConversationMapper.toDomain(makeConversationRow()));
    const inserted = unwrap(await repo.insert(conversation));
    expect(inserted.id.toString()).toBe(conversation.id.toString());
    expect(client.rows("conversations")).toHaveLength(1);
  });

  it("insert surfaces a Supabase error", async () => {
    const client = createFakeSupabaseClient();
    client.forceErrorOnce("conversations", "fk violation");
    const repo = new ConversationRepository(client);
    const conversation = unwrap(ConversationMapper.toDomain(makeConversationRow()));
    const error = unwrapErr(await repo.insert(conversation));
    expect(error.message).toContain("fk violation");
  });

  it("update mutates the existing row", async () => {
    const client = createFakeSupabaseClient();
    const row = makeConversationRow({ message_count: 0 });
    client.seed("conversations", [row]);
    const repo = new ConversationRepository(client);
    const conversation = unwrap(ConversationMapper.toDomain(row)).recordMessage(
      "INCOMING",
      { d1: 1, d2: 0, d3: 0, d5: 0 },
      new Date(),
    );
    const updated = unwrap(await repo.update(conversation));
    expect(updated.messageCount).toBe(1);
    expect(client.rows("conversations")[0]?.message_count).toBe(1);
  });

  it("insert surfaces 'no row returned' when the write resolves with no data", async () => {
    const client = createFakeSupabaseClient();
    client.forceNullOnce("conversations");
    const repo = new ConversationRepository(client);
    const conversation = unwrap(ConversationMapper.toDomain(makeConversationRow()));
    const error = unwrapErr(await repo.insert(conversation));
    expect(error.message).toContain("no row returned");
  });

  it("update surfaces 'no row returned' when the write resolves with no data", async () => {
    const client = createFakeSupabaseClient();
    const row = makeConversationRow();
    client.seed("conversations", [row]);
    client.forceNullOnce("conversations");
    const repo = new ConversationRepository(client);
    const conversation = unwrap(ConversationMapper.toDomain(row));
    const error = unwrapErr(await repo.update(conversation));
    expect(error.message).toContain("no row returned");
  });

  it("update surfaces a Supabase error", async () => {
    const client = createFakeSupabaseClient();
    const row = makeConversationRow();
    client.seed("conversations", [row]);
    client.forceErrorOnce("conversations", "row locked");
    const repo = new ConversationRepository(client);
    const conversation = unwrap(ConversationMapper.toDomain(row));
    const error = unwrapErr(await repo.update(conversation));
    expect(error.message).toContain("row locked");
  });
});
