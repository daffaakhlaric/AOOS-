import { describe, expect, it } from "vitest";

import { ConversationService } from "../../../src/application/services/ConversationService.js";
import { GetConversation } from "../../../src/application/use-cases/GetConversation.js";
import { SaveMessage } from "../../../src/application/use-cases/SaveMessage.js";
import { LeadStoreEvents } from "../../../src/domain/events/LeadStoreEvents.js";
import { ConversationRepository } from "../../../src/infrastructure/supabase/ConversationRepository.js";
import { LeadRepository } from "../../../src/infrastructure/supabase/LeadRepository.js";
import { MessageRepository } from "../../../src/infrastructure/supabase/MessageRepository.js";
import { makeConversationRow, makeLeadRow } from "../../fixtures/leadStoreFixtures.js";
import { createFakePublisher } from "../../helpers/publisher.js";
import { unwrap } from "../../helpers/result.js";
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

  const service = new ConversationService(
    new SaveMessage(messageRepository, conversationRepository, leadRepository, events),
    new GetConversation(conversationRepository),
  );
  return { service, conversationRow };
}

describe("ConversationService facade", () => {
  it("save() delegates to SaveMessage", async () => {
    const { service, conversationRow } = setup();
    const message = unwrap(
      await service.save({
        conversationId: conversationRow.id,
        direction: "INCOMING",
        body: "hi",
        tenantId: "t1",
        correlationId: "c1",
      }),
    );
    expect(message.direction).toBe("INCOMING");
  });

  it("byLeadId() delegates to GetConversation", async () => {
    const { service, conversationRow } = setup();
    const conversation = unwrap(await service.byLeadId(conversationRow.lead_id));
    expect(conversation.id.toString()).toBe(conversationRow.id);
  });
});
