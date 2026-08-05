import type { KnowledgeSynchronizationSessionRecord } from "../session/knowledge-synchronization-session-record.js";
import { KnowledgeSynchronizationSessionState } from "../session/knowledge-synchronization-session-state.js";
import { generateId } from "../utils/id.js";

const DEFAULT_SESSION_TTL_MS = 15 * 60 * 1000;

/** Produces a fresh, unregistered `KnowledgeSynchronizationSessionRecord` — distinct from `KnowledgeSynchronizationSession#open()`, which also registers it into that class's own in-memory Map. */
export class SynchronizationSessionFactory {
  create(
    token: string,
    holder: string,
    ttlMs = DEFAULT_SESSION_TTL_MS,
  ): KnowledgeSynchronizationSessionRecord {
    const now = new Date();
    return {
      id: generateId(),
      token,
      holder,
      state: KnowledgeSynchronizationSessionState.OPEN,
      openedAt: now.toISOString(),
      expiresAt: new Date(now.getTime() + ttlMs).toISOString(),
    };
  }
}
