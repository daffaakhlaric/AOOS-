import type { KnowledgeQuerySessionRecord } from "../session/knowledge-query-session-record.js";
import { KnowledgeQuerySessionState } from "../session/knowledge-query-session-state.js";
import { generateId } from "../utils/id.js";

const DEFAULT_SESSION_TTL_MS = 15 * 60 * 1000;

/**
 * Produces a fresh, unregistered `KnowledgeQuerySessionRecord` — distinct from
 * `KnowledgeQuerySession#open()`, which also registers it into that class's own
 * in-memory Map.
 */
export class KnowledgeSessionFactory {
  create(
    token: string,
    holder: string,
    ttlMs = DEFAULT_SESSION_TTL_MS,
  ): KnowledgeQuerySessionRecord {
    const now = new Date();
    return {
      id: generateId(),
      token,
      holder,
      state: KnowledgeQuerySessionState.OPEN,
      openedAt: now.toISOString(),
      expiresAt: new Date(now.getTime() + ttlMs).toISOString(),
    };
  }
}
