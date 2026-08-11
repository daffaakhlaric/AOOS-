import { describe, expect, it } from "vitest";

import { GetConversation } from "../../../src/application/use-cases/GetConversation.js";
import { ConversationRepository } from "../../../src/infrastructure/supabase/ConversationRepository.js";
import { makeConversationRow } from "../../fixtures/leadStoreFixtures.js";
import { unwrap, unwrapErr } from "../../helpers/result.js";
import { createFakeSupabaseClient } from "../../helpers/supabase.js";

describe("GetConversation", () => {
  it("returns the conversation for a lead", async () => {
    const client = createFakeSupabaseClient();
    const row = makeConversationRow();
    client.seed("conversations", [row]);
    const useCase = new GetConversation(new ConversationRepository(client));
    const conversation = unwrap(await useCase.execute(row.lead_id));
    expect(conversation.id.toString()).toBe(row.id);
  });

  it("returns ConversationNotFoundError when missing", async () => {
    const client = createFakeSupabaseClient();
    const useCase = new GetConversation(new ConversationRepository(client));
    const error = unwrapErr(await useCase.execute("lead-without-conversation"));
    expect(error.message).toContain("not found");
  });

  it("rejects an empty leadId", async () => {
    const client = createFakeSupabaseClient();
    const useCase = new GetConversation(new ConversationRepository(client));
    const error = unwrapErr(await useCase.execute(""));
    expect(error.message).toContain("LeadId");
  });

  it("surfaces a repository error", async () => {
    const client = createFakeSupabaseClient();
    client.forceErrorOnce("conversations", "timeout");
    const useCase = new GetConversation(new ConversationRepository(client));
    const error = unwrapErr(await useCase.execute("lead-1"));
    expect(error.message).toContain("timeout");
  });
});
