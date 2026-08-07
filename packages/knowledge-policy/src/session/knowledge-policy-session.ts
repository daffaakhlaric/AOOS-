import { PolicyLeaseException } from "../errors/policy-lease-exception.js";
import { PolicySessionException } from "../errors/policy-session-exception.js";
import { generateId } from "../utils/id.js";

import type { KnowledgePolicySessionRecord } from "./knowledge-policy-session-record.js";
import { KnowledgePolicySessionState } from "./knowledge-policy-session-state.js";

const DEFAULT_SESSION_TTL_MS = 15 * 60 * 1000;

/**
 * "KnowledgePolicySession" (docs/PROMPT-005.7I-KNOWLEDGE-POLICY.md — "Public API") —
 * one in-memory `Map<token, KnowledgePolicySessionRecord>` implementing the
 * Open/Resume/Close/Cancel/Expire/Renew access-window lifecycle.
 */
export class KnowledgePolicySession {
  private readonly sessionsByToken = new Map<string, KnowledgePolicySessionRecord>();

  open(
    token: string,
    holder: string,
    ttlMs = DEFAULT_SESSION_TTL_MS,
  ): KnowledgePolicySessionRecord {
    if (this.sessionsByToken.has(token)) {
      throw new PolicySessionException(`A Session is already open for Token "${token}"`);
    }
    const now = new Date();
    const record: KnowledgePolicySessionRecord = {
      id: generateId(),
      token,
      holder,
      state: KnowledgePolicySessionState.OPEN,
      openedAt: now.toISOString(),
      expiresAt: new Date(now.getTime() + ttlMs).toISOString(),
    };
    this.sessionsByToken.set(token, record);
    return record;
  }

  resume(token: string, ttlMs = DEFAULT_SESSION_TTL_MS): KnowledgePolicySessionRecord {
    const record = this.requireInState(token, [
      KnowledgePolicySessionState.CLOSED,
      KnowledgePolicySessionState.EXPIRED,
    ]);
    const now = new Date();
    return this.write({
      ...record,
      state: KnowledgePolicySessionState.OPEN,
      expiresAt: new Date(now.getTime() + ttlMs).toISOString(),
      closedAt: undefined,
    });
  }

  close(token: string): KnowledgePolicySessionRecord {
    const record = this.requireInState(token, [KnowledgePolicySessionState.OPEN]);
    return this.write({
      ...record,
      state: KnowledgePolicySessionState.CLOSED,
      closedAt: new Date().toISOString(),
    });
  }

  cancel(token: string): KnowledgePolicySessionRecord {
    const record = this.requireInState(token, [KnowledgePolicySessionState.OPEN]);
    return this.write({
      ...record,
      state: KnowledgePolicySessionState.CANCELLED,
      closedAt: new Date().toISOString(),
    });
  }

  expire(token: string): KnowledgePolicySessionRecord {
    const record = this.require(token);
    return this.write({
      ...record,
      state: KnowledgePolicySessionState.EXPIRED,
      closedAt: new Date().toISOString(),
    });
  }

  renew(token: string, ttlMs = DEFAULT_SESSION_TTL_MS): KnowledgePolicySessionRecord {
    const record = this.requireInState(token, [KnowledgePolicySessionState.OPEN]);
    const now = new Date();
    if (Date.parse(record.expiresAt) <= now.getTime()) {
      throw new PolicyLeaseException(
        `Cannot renew Session for Token "${token}": it already expired`,
      );
    }
    return this.write({
      ...record,
      expiresAt: new Date(now.getTime() + ttlMs).toISOString(),
      renewedAt: now.toISOString(),
    });
  }

  get(token: string): KnowledgePolicySessionRecord | undefined {
    return this.sessionsByToken.get(token);
  }

  require(token: string): KnowledgePolicySessionRecord {
    const record = this.sessionsByToken.get(token);
    if (!record) {
      throw new PolicySessionException(`No Session is open for Token "${token}"`);
    }
    return record;
  }

  private requireInState(
    token: string,
    allowedStates: readonly KnowledgePolicySessionState[],
  ): KnowledgePolicySessionRecord {
    const record = this.require(token);
    if (!allowedStates.includes(record.state)) {
      throw new PolicySessionException(
        `Session for Token "${token}" is "${record.state}" — cannot perform this operation`,
      );
    }
    return record;
  }

  private write(record: KnowledgePolicySessionRecord): KnowledgePolicySessionRecord {
    this.sessionsByToken.set(record.token, record);
    return record;
  }
}
