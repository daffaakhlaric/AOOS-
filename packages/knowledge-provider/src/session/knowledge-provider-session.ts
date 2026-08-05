import { ProviderLeaseException } from "../errors/provider-lease-exception.js";
import { ProviderSessionException } from "../errors/provider-session-exception.js";
import { generateId } from "../utils/id.js";

import type { KnowledgeProviderSessionRecord } from "./knowledge-provider-session-record.js";
import { KnowledgeProviderSessionState } from "./knowledge-provider-session-state.js";

const DEFAULT_SESSION_TTL_MS = 15 * 60 * 1000;

/** "KnowledgeProviderSession" (docs/PROMPT-005.7F-KNOWLEDGE-PROVIDER.md — "PUBLIC API") — one in-memory `Map<token, KnowledgeProviderSessionRecord>`, mirroring `@aos/knowledge-synchronization`'s `KnowledgeSynchronizationSession`. */
export class KnowledgeProviderSession {
  private readonly sessionsByToken = new Map<string, KnowledgeProviderSessionRecord>();

  open(
    token: string,
    holder: string,
    ttlMs = DEFAULT_SESSION_TTL_MS,
  ): KnowledgeProviderSessionRecord {
    if (this.sessionsByToken.has(token)) {
      throw new ProviderSessionException(`A Session is already open for Token "${token}"`);
    }
    const now = new Date();
    const record: KnowledgeProviderSessionRecord = {
      id: generateId(),
      token,
      holder,
      state: KnowledgeProviderSessionState.OPEN,
      openedAt: now.toISOString(),
      expiresAt: new Date(now.getTime() + ttlMs).toISOString(),
    };
    this.sessionsByToken.set(token, record);
    return record;
  }

  resume(token: string, ttlMs = DEFAULT_SESSION_TTL_MS): KnowledgeProviderSessionRecord {
    const record = this.requireInState(token, [
      KnowledgeProviderSessionState.CLOSED,
      KnowledgeProviderSessionState.EXPIRED,
    ]);
    const now = new Date();
    return this.write({
      ...record,
      state: KnowledgeProviderSessionState.OPEN,
      expiresAt: new Date(now.getTime() + ttlMs).toISOString(),
      closedAt: undefined,
    });
  }

  close(token: string): KnowledgeProviderSessionRecord {
    const record = this.requireInState(token, [KnowledgeProviderSessionState.OPEN]);
    return this.write({
      ...record,
      state: KnowledgeProviderSessionState.CLOSED,
      closedAt: new Date().toISOString(),
    });
  }

  cancel(token: string): KnowledgeProviderSessionRecord {
    const record = this.requireInState(token, [KnowledgeProviderSessionState.OPEN]);
    return this.write({
      ...record,
      state: KnowledgeProviderSessionState.CANCELLED,
      closedAt: new Date().toISOString(),
    });
  }

  expire(token: string): KnowledgeProviderSessionRecord {
    const record = this.require(token);
    return this.write({
      ...record,
      state: KnowledgeProviderSessionState.EXPIRED,
      closedAt: new Date().toISOString(),
    });
  }

  renew(token: string, ttlMs = DEFAULT_SESSION_TTL_MS): KnowledgeProviderSessionRecord {
    const record = this.requireInState(token, [KnowledgeProviderSessionState.OPEN]);
    const now = new Date();
    if (Date.parse(record.expiresAt) <= now.getTime()) {
      throw new ProviderLeaseException(
        `Cannot renew Session for Token "${token}": it already expired`,
      );
    }
    return this.write({
      ...record,
      expiresAt: new Date(now.getTime() + ttlMs).toISOString(),
      renewedAt: now.toISOString(),
    });
  }

  get(token: string): KnowledgeProviderSessionRecord | undefined {
    return this.sessionsByToken.get(token);
  }

  require(token: string): KnowledgeProviderSessionRecord {
    const record = this.sessionsByToken.get(token);
    if (!record) {
      throw new ProviderSessionException(`No Session is open for Token "${token}"`);
    }
    return record;
  }

  private requireInState(
    token: string,
    allowedStates: readonly KnowledgeProviderSessionState[],
  ): KnowledgeProviderSessionRecord {
    const record = this.require(token);
    if (!allowedStates.includes(record.state)) {
      throw new ProviderSessionException(
        `Session for Token "${token}" is "${record.state}" — cannot perform this operation`,
      );
    }
    return record;
  }

  private write(record: KnowledgeProviderSessionRecord): KnowledgeProviderSessionRecord {
    this.sessionsByToken.set(record.token, record);
    return record;
  }
}
