import { SourceLeaseException } from "../errors/source-lease-exception.js";
import { SourceSessionException } from "../errors/source-session-exception.js";
import { generateId } from "../utils/id.js";

import type { KnowledgeSourceSessionRecord } from "./knowledge-source-session-record.js";
import { KnowledgeSourceSessionState } from "./knowledge-source-session-state.js";

const DEFAULT_SESSION_TTL_MS = 15 * 60 * 1000;

/** "KnowledgeSourceSession" (docs/PROMPT-005.7G-KNOWLEDGE-SOURCE-MANAGER.md — "PUBLIC API") — one in-memory `Map<token, KnowledgeSourceSessionRecord>`. */
export class KnowledgeSourceSession {
  private readonly sessionsByToken = new Map<string, KnowledgeSourceSessionRecord>();

  open(
    token: string,
    holder: string,
    ttlMs = DEFAULT_SESSION_TTL_MS,
  ): KnowledgeSourceSessionRecord {
    if (this.sessionsByToken.has(token)) {
      throw new SourceSessionException(`A Session is already open for Token "${token}"`);
    }
    const now = new Date();
    const record: KnowledgeSourceSessionRecord = {
      id: generateId(),
      token,
      holder,
      state: KnowledgeSourceSessionState.OPEN,
      openedAt: now.toISOString(),
      expiresAt: new Date(now.getTime() + ttlMs).toISOString(),
    };
    this.sessionsByToken.set(token, record);
    return record;
  }

  resume(token: string, ttlMs = DEFAULT_SESSION_TTL_MS): KnowledgeSourceSessionRecord {
    const record = this.requireInState(token, [
      KnowledgeSourceSessionState.CLOSED,
      KnowledgeSourceSessionState.EXPIRED,
    ]);
    const now = new Date();
    return this.write({
      ...record,
      state: KnowledgeSourceSessionState.OPEN,
      expiresAt: new Date(now.getTime() + ttlMs).toISOString(),
      closedAt: undefined,
    });
  }

  close(token: string): KnowledgeSourceSessionRecord {
    const record = this.requireInState(token, [KnowledgeSourceSessionState.OPEN]);
    return this.write({
      ...record,
      state: KnowledgeSourceSessionState.CLOSED,
      closedAt: new Date().toISOString(),
    });
  }

  cancel(token: string): KnowledgeSourceSessionRecord {
    const record = this.requireInState(token, [KnowledgeSourceSessionState.OPEN]);
    return this.write({
      ...record,
      state: KnowledgeSourceSessionState.CANCELLED,
      closedAt: new Date().toISOString(),
    });
  }

  expire(token: string): KnowledgeSourceSessionRecord {
    const record = this.require(token);
    return this.write({
      ...record,
      state: KnowledgeSourceSessionState.EXPIRED,
      closedAt: new Date().toISOString(),
    });
  }

  renew(token: string, ttlMs = DEFAULT_SESSION_TTL_MS): KnowledgeSourceSessionRecord {
    const record = this.requireInState(token, [KnowledgeSourceSessionState.OPEN]);
    const now = new Date();
    if (Date.parse(record.expiresAt) <= now.getTime()) {
      throw new SourceLeaseException(
        `Cannot renew Session for Token "${token}": it already expired`,
      );
    }
    return this.write({
      ...record,
      expiresAt: new Date(now.getTime() + ttlMs).toISOString(),
      renewedAt: now.toISOString(),
    });
  }

  get(token: string): KnowledgeSourceSessionRecord | undefined {
    return this.sessionsByToken.get(token);
  }

  require(token: string): KnowledgeSourceSessionRecord {
    const record = this.sessionsByToken.get(token);
    if (!record) {
      throw new SourceSessionException(`No Session is open for Token "${token}"`);
    }
    return record;
  }

  private requireInState(
    token: string,
    allowedStates: readonly KnowledgeSourceSessionState[],
  ): KnowledgeSourceSessionRecord {
    const record = this.require(token);
    if (!allowedStates.includes(record.state)) {
      throw new SourceSessionException(
        `Session for Token "${token}" is "${record.state}" — cannot perform this operation`,
      );
    }
    return record;
  }

  private write(record: KnowledgeSourceSessionRecord): KnowledgeSourceSessionRecord {
    this.sessionsByToken.set(record.token, record);
    return record;
  }
}
