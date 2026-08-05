import type { KnowledgeProviderSessionRecord } from "../session/knowledge-provider-session-record.js";
import { KnowledgeProviderSessionState } from "../session/knowledge-provider-session-state.js";
import { generateId } from "../utils/id.js";

const DEFAULT_SESSION_TTL_MS = 15 * 60 * 1000;

/** Produces a fresh, unregistered `KnowledgeProviderSessionRecord` — distinct from `KnowledgeProviderSession#open()`, which also registers it into that class's own in-memory Map. */
export class ProviderSessionFactory {
  create(
    token: string,
    holder: string,
    ttlMs = DEFAULT_SESSION_TTL_MS,
  ): KnowledgeProviderSessionRecord {
    const now = new Date();
    return {
      id: generateId(),
      token,
      holder,
      state: KnowledgeProviderSessionState.OPEN,
      openedAt: now.toISOString(),
      expiresAt: new Date(now.getTime() + ttlMs).toISOString(),
    };
  }
}
