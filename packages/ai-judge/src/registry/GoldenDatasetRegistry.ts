import type { IGoldenDatasetManager } from "../contracts/IGoldenDatasetManager.js";
import type { GoldenConversation } from "../domain/entities/GoldenConversation.js";

/**
 * In-memory golden-conversation store (spec "registry/GoldenDatasetRegistry.ts"). One instance
 * per `AiJudgeFactory.create()` call — never a module-level singleton, so tests never leak state
 * across each other (constitution §3.13 composition-root discipline).
 */
export class GoldenDatasetRegistry implements IGoldenDatasetManager {
  private readonly byId = new Map<string, GoldenConversation>();

  add(conversation: GoldenConversation): void {
    this.byId.set(conversation.id, conversation);
  }

  getAll(): ReadonlyArray<GoldenConversation> {
    return Array.from(this.byId.values());
  }

  findById(id: string): GoldenConversation | undefined {
    return this.byId.get(id);
  }

  findByPersonaId(personaId: string): ReadonlyArray<GoldenConversation> {
    return this.getAll().filter((c) => c.personaId === personaId);
  }

  clear(): void {
    this.byId.clear();
  }

  get size(): number {
    return this.byId.size;
  }
}
