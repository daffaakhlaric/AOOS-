import { SynchronizationLeaseException } from "../errors/synchronization-lease-exception.js";
import { SynchronizationSessionException } from "../errors/synchronization-session-exception.js";
import { generateId } from "../utils/id.js";

import type { KnowledgeSynchronizationSessionRecord } from "./knowledge-synchronization-session-record.js";
import { KnowledgeSynchronizationSessionState } from "./knowledge-synchronization-session-state.js";

const DEFAULT_SESSION_TTL_MS = 15 * 60 * 1000;

/** "KnowledgeSynchronizationSession" (docs/PROMPT-005.7E-KNOWLEDGE-SYNCHRONIZATION.md — "PUBLIC API") — one in-memory `Map<token, KnowledgeSynchronizationSessionRecord>`, mirroring `@aos/knowledge-retrieval`'s `KnowledgeQuerySession`. */
export class KnowledgeSynchronizationSession {
  private readonly sessionsByToken = new Map<string, KnowledgeSynchronizationSessionRecord>();

  open(
    token: string,
    holder: string,
    ttlMs = DEFAULT_SESSION_TTL_MS,
  ): KnowledgeSynchronizationSessionRecord {
    if (this.sessionsByToken.has(token)) {
      throw new SynchronizationSessionException(`A Session is already open for Token "${token}"`);
    }
    const now = new Date();
    const record: KnowledgeSynchronizationSessionRecord = {
      id: generateId(),
      token,
      holder,
      state: KnowledgeSynchronizationSessionState.OPEN,
      openedAt: now.toISOString(),
      expiresAt: new Date(now.getTime() + ttlMs).toISOString(),
    };
    this.sessionsByToken.set(token, record);
    return record;
  }

  resume(token: string, ttlMs = DEFAULT_SESSION_TTL_MS): KnowledgeSynchronizationSessionRecord {
    const record = this.requireInState(token, [
      KnowledgeSynchronizationSessionState.CLOSED,
      KnowledgeSynchronizationSessionState.EXPIRED,
    ]);
    const now = new Date();
    return this.write({
      ...record,
      state: KnowledgeSynchronizationSessionState.OPEN,
      expiresAt: new Date(now.getTime() + ttlMs).toISOString(),
      closedAt: undefined,
    });
  }

  close(token: string): KnowledgeSynchronizationSessionRecord {
    const record = this.requireInState(token, [KnowledgeSynchronizationSessionState.OPEN]);
    return this.write({
      ...record,
      state: KnowledgeSynchronizationSessionState.CLOSED,
      closedAt: new Date().toISOString(),
    });
  }

  cancel(token: string): KnowledgeSynchronizationSessionRecord {
    const record = this.requireInState(token, [KnowledgeSynchronizationSessionState.OPEN]);
    return this.write({
      ...record,
      state: KnowledgeSynchronizationSessionState.CANCELLED,
      closedAt: new Date().toISOString(),
    });
  }

  expire(token: string): KnowledgeSynchronizationSessionRecord {
    const record = this.require(token);
    return this.write({
      ...record,
      state: KnowledgeSynchronizationSessionState.EXPIRED,
      closedAt: new Date().toISOString(),
    });
  }

  renew(token: string, ttlMs = DEFAULT_SESSION_TTL_MS): KnowledgeSynchronizationSessionRecord {
    const record = this.requireInState(token, [KnowledgeSynchronizationSessionState.OPEN]);
    const now = new Date();
    if (Date.parse(record.expiresAt) <= now.getTime()) {
      throw new SynchronizationLeaseException(
        `Cannot renew Session for Token "${token}": it already expired`,
      );
    }
    return this.write({
      ...record,
      expiresAt: new Date(now.getTime() + ttlMs).toISOString(),
      renewedAt: now.toISOString(),
    });
  }

  get(token: string): KnowledgeSynchronizationSessionRecord | undefined {
    return this.sessionsByToken.get(token);
  }

  require(token: string): KnowledgeSynchronizationSessionRecord {
    const record = this.sessionsByToken.get(token);
    if (!record) {
      throw new SynchronizationSessionException(`No Session is open for Token "${token}"`);
    }
    return record;
  }

  private requireInState(
    token: string,
    allowedStates: readonly KnowledgeSynchronizationSessionState[],
  ): KnowledgeSynchronizationSessionRecord {
    const record = this.require(token);
    if (!allowedStates.includes(record.state)) {
      throw new SynchronizationSessionException(
        `Session for Token "${token}" is "${record.state}" — cannot perform this operation`,
      );
    }
    return record;
  }

  private write(
    record: KnowledgeSynchronizationSessionRecord,
  ): KnowledgeSynchronizationSessionRecord {
    this.sessionsByToken.set(record.token, record);
    return record;
  }
}
