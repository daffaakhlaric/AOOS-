import { RetrievalLeaseException } from "../errors/retrieval-lease-exception.js";
import { RetrievalSessionException } from "../errors/retrieval-session-exception.js";
import { generateId } from "../utils/id.js";

import type { KnowledgeQuerySessionRecord } from "./knowledge-query-session-record.js";
import { KnowledgeQuerySessionState } from "./knowledge-query-session-state.js";

const DEFAULT_SESSION_TTL_MS = 15 * 60 * 1000;

/**
 * "KnowledgeQuerySession ... Supports Open, Resume, Close, Cancel, Expire, Renew."
 * (docs/PROMPT-005.7D-KNOWLEDGE-RETRIEVAL.md) — one in-memory
 * `Map<token, KnowledgeQuerySessionRecord>`, mirroring `@aos/knowledge-runtime`'s
 * `KnowledgeRuntimeSession`.
 */
export class KnowledgeQuerySession {
  private readonly sessionsByToken = new Map<string, KnowledgeQuerySessionRecord>();

  open(token: string, holder: string, ttlMs = DEFAULT_SESSION_TTL_MS): KnowledgeQuerySessionRecord {
    if (this.sessionsByToken.has(token)) {
      throw new RetrievalSessionException(`A Session is already open for Token "${token}"`);
    }
    const now = new Date();
    const record: KnowledgeQuerySessionRecord = {
      id: generateId(),
      token,
      holder,
      state: KnowledgeQuerySessionState.OPEN,
      openedAt: now.toISOString(),
      expiresAt: new Date(now.getTime() + ttlMs).toISOString(),
    };
    this.sessionsByToken.set(token, record);
    return record;
  }

  resume(token: string, ttlMs = DEFAULT_SESSION_TTL_MS): KnowledgeQuerySessionRecord {
    const record = this.requireInState(token, [
      KnowledgeQuerySessionState.CLOSED,
      KnowledgeQuerySessionState.EXPIRED,
    ]);
    const now = new Date();
    return this.write({
      ...record,
      state: KnowledgeQuerySessionState.OPEN,
      expiresAt: new Date(now.getTime() + ttlMs).toISOString(),
      closedAt: undefined,
    });
  }

  close(token: string): KnowledgeQuerySessionRecord {
    const record = this.requireInState(token, [KnowledgeQuerySessionState.OPEN]);
    return this.write({
      ...record,
      state: KnowledgeQuerySessionState.CLOSED,
      closedAt: new Date().toISOString(),
    });
  }

  cancel(token: string): KnowledgeQuerySessionRecord {
    const record = this.requireInState(token, [KnowledgeQuerySessionState.OPEN]);
    return this.write({
      ...record,
      state: KnowledgeQuerySessionState.CANCELLED,
      closedAt: new Date().toISOString(),
    });
  }

  expire(token: string): KnowledgeQuerySessionRecord {
    const record = this.require(token);
    return this.write({
      ...record,
      state: KnowledgeQuerySessionState.EXPIRED,
      closedAt: new Date().toISOString(),
    });
  }

  renew(token: string, ttlMs = DEFAULT_SESSION_TTL_MS): KnowledgeQuerySessionRecord {
    const record = this.requireInState(token, [KnowledgeQuerySessionState.OPEN]);
    const now = new Date();
    if (Date.parse(record.expiresAt) <= now.getTime()) {
      throw new RetrievalLeaseException(
        `Cannot renew Session for Token "${token}": it already expired`,
      );
    }
    return this.write({
      ...record,
      expiresAt: new Date(now.getTime() + ttlMs).toISOString(),
      renewedAt: now.toISOString(),
    });
  }

  get(token: string): KnowledgeQuerySessionRecord | undefined {
    return this.sessionsByToken.get(token);
  }

  require(token: string): KnowledgeQuerySessionRecord {
    const record = this.sessionsByToken.get(token);
    if (!record) {
      throw new RetrievalSessionException(`No Session is open for Token "${token}"`);
    }
    return record;
  }

  private requireInState(
    token: string,
    allowedStates: readonly KnowledgeQuerySessionState[],
  ): KnowledgeQuerySessionRecord {
    const record = this.require(token);
    if (!allowedStates.includes(record.state)) {
      throw new RetrievalSessionException(
        `Session for Token "${token}" is "${record.state}" — cannot perform this operation`,
      );
    }
    return record;
  }

  private write(record: KnowledgeQuerySessionRecord): KnowledgeQuerySessionRecord {
    this.sessionsByToken.set(record.token, record);
    return record;
  }
}
