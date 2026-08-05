import type { KnowledgeRuntimeSessionRecord } from "../session/knowledge-runtime-session-record.js";
import { KnowledgeRuntimeSessionState } from "../session/knowledge-runtime-session-state.js";
import { generateId } from "../utils/id.js";

const DEFAULT_SESSION_TTL_MS = 15 * 60 * 1000;

/**
 * Produces a fresh, unregistered `KnowledgeRuntimeSessionRecord` — distinct from
 * `KnowledgeRuntimeSession#open()`, which also registers it into that class's own
 * in-memory Map. Useful for callers that want to build a record shape (e.g. for a test
 * fixture, or a future `IKnowledgeRuntimeStorage` implementation) without going through
 * the live Session engine.
 */
export class RuntimeSessionFactory {
  create(
    instanceToken: string,
    holder: string,
    ttlMs = DEFAULT_SESSION_TTL_MS,
  ): KnowledgeRuntimeSessionRecord {
    const now = new Date();
    return {
      id: generateId(),
      instanceToken,
      state: KnowledgeRuntimeSessionState.OPEN,
      lease: {
        id: generateId(),
        token: instanceToken,
        holder,
        acquiredAt: now.toISOString(),
        expiresAt: new Date(now.getTime() + ttlMs).toISOString(),
      },
      openedAt: now.toISOString(),
    };
  }
}
