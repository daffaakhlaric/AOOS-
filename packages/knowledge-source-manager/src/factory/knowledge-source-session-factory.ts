import type { KnowledgeSourceSessionRecord } from "../session/knowledge-source-session-record.js";
import { KnowledgeSourceSessionState } from "../session/knowledge-source-session-state.js";
import { generateId } from "../utils/id.js";

const DEFAULT_SESSION_TTL_MS = 15 * 60 * 1000;

/** Produces a fresh, unregistered `KnowledgeSourceSessionRecord` — distinct from `KnowledgeSourceSession#open()`, which also registers it into that class's own in-memory Map. */
export class KnowledgeSourceSessionFactory {
  create(
    token: string,
    holder: string,
    ttlMs = DEFAULT_SESSION_TTL_MS,
  ): KnowledgeSourceSessionRecord {
    const now = new Date();
    return {
      id: generateId(),
      token,
      holder,
      state: KnowledgeSourceSessionState.OPEN,
      openedAt: now.toISOString(),
      expiresAt: new Date(now.getTime() + ttlMs).toISOString(),
    };
  }
}
