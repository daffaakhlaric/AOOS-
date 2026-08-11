import { err, ok, type Result } from "@aos/common";

import type { IConversationRepository } from "../../contracts/IConversationRepository.js";
import type { Conversation } from "../../domain/entities/Conversation.js";
import { SupabaseError } from "../../domain/errors/SupabaseError.js";
import type { ConversationId } from "../../domain/value-objects/ConversationId.js";
import type { LeadId } from "../../domain/value-objects/LeadId.js";
import { ConversationMapper, type ConversationRow } from "../mappers/ConversationMapper.js";

import type { SupabaseClientLike } from "./SupabaseTypes.js";

const TABLE = "conversations";

/** Supabase implementation of `IConversationRepository`. */
export class ConversationRepository implements IConversationRepository {
  constructor(private readonly client: SupabaseClientLike) {}

  async findById(id: ConversationId): Promise<Result<Conversation | undefined, SupabaseError>> {
    const { data, error } = await this.client
      .from<ConversationRow>(TABLE)
      .select("*")
      .eq("id", id.toString())
      .maybeSingle();
    if (error !== null) {
      return err(new SupabaseError(`ConversationRepository.findById failed: ${error.message}`));
    }
    if (data === null) {
      return ok(undefined);
    }
    return mapRow(data);
  }

  async findByLeadId(leadId: LeadId): Promise<Result<Conversation | undefined, SupabaseError>> {
    const { data, error } = await this.client
      .from<ConversationRow>(TABLE)
      .select("*")
      .eq("lead_id", leadId.toString())
      .maybeSingle();
    if (error !== null) {
      return err(new SupabaseError(`ConversationRepository.findByLeadId failed: ${error.message}`));
    }
    if (data === null) {
      return ok(undefined);
    }
    return mapRow(data);
  }

  async insert(conversation: Conversation): Promise<Result<Conversation, SupabaseError>> {
    const { data, error } = await this.client
      .from<ConversationRow>(TABLE)
      .insert(ConversationMapper.toRow(conversation))
      .select("*")
      .single();
    if (error !== null) {
      return err(new SupabaseError(`ConversationRepository.insert failed: ${error.message}`));
    }
    if (data === null) {
      return err(new SupabaseError("ConversationRepository.insert failed: no row returned"));
    }
    return mapRow(data);
  }

  async update(conversation: Conversation): Promise<Result<Conversation, SupabaseError>> {
    const { data, error } = await this.client
      .from<ConversationRow>(TABLE)
      .update(ConversationMapper.toRow(conversation))
      .eq("id", conversation.id.toString())
      .select("*")
      .single();
    if (error !== null) {
      return err(new SupabaseError(`ConversationRepository.update failed: ${error.message}`));
    }
    if (data === null) {
      return err(new SupabaseError("ConversationRepository.update failed: no row returned"));
    }
    return mapRow(data);
  }
}

function mapRow(row: ConversationRow): Result<Conversation, SupabaseError> {
  const result = ConversationMapper.toDomain(row);
  if (!result.ok) {
    return err(
      new SupabaseError(`ConversationRepository: row mapping failed: ${result.error.message}`),
    );
  }
  return ok(result.value);
}
