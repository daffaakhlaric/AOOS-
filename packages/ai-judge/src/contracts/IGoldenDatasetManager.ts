import type { GoldenConversation } from "../domain/entities/GoldenConversation.js";

/** Contract for the in-memory golden-dataset store (`GoldenDatasetRegistry` implements this). */
export interface IGoldenDatasetManager {
  add(conversation: GoldenConversation): void;
  getAll(): ReadonlyArray<GoldenConversation>;
  findById(id: string): GoldenConversation | undefined;
  findByPersonaId(personaId: string): ReadonlyArray<GoldenConversation>;
}
