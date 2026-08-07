import { VersionLeaseException } from "../errors/version-lease-exception.js";
import { VersionSessionException } from "../errors/version-session-exception.js";
import { generateId } from "../utils/id.js";

import type { KnowledgeVersionSessionRecord } from "./knowledge-version-session-record.js";
import { KnowledgeVersionSessionState } from "./knowledge-version-session-state.js";

const DEFAULT_SESSION_TTL_MS = 15 * 60 * 1000;

/**
 * "KnowledgeVersionSession" (docs/PROMPT-005.7H-KNOWLEDGE-VERSIONING.md — "Public API")
 * — one in-memory `Map<token, KnowledgeVersionSessionRecord>` implementing the
 * Open/Resume/Close/Cancel/Expire/Renew access-window lifecycle established by the
 * sibling Knowledge packages.
 */
export class KnowledgeVersionSession {
  private readonly sessionsByToken = new Map<string, KnowledgeVersionSessionRecord>();

  open(
    token: string,
    holder: string,
    ttlMs = DEFAULT_SESSION_TTL_MS,
  ): KnowledgeVersionSessionRecord {
    if (this.sessionsByToken.has(token)) {
      throw new VersionSessionException(`A Session is already open for Token "${token}"`);
    }
    const now = new Date();
    const record: KnowledgeVersionSessionRecord = {
      id: generateId(),
      token,
      holder,
      state: KnowledgeVersionSessionState.OPEN,
      openedAt: now.toISOString(),
      expiresAt: new Date(now.getTime() + ttlMs).toISOString(),
    };
    this.sessionsByToken.set(token, record);
    return record;
  }

  resume(token: string, ttlMs = DEFAULT_SESSION_TTL_MS): KnowledgeVersionSessionRecord {
    const record = this.requireInState(token, [
      KnowledgeVersionSessionState.CLOSED,
      KnowledgeVersionSessionState.EXPIRED,
    ]);
    const now = new Date();
    return this.write({
      ...record,
      state: KnowledgeVersionSessionState.OPEN,
      expiresAt: new Date(now.getTime() + ttlMs).toISOString(),
      closedAt: undefined,
    });
  }

  close(token: string): KnowledgeVersionSessionRecord {
    const record = this.requireInState(token, [KnowledgeVersionSessionState.OPEN]);
    return this.write({
      ...record,
      state: KnowledgeVersionSessionState.CLOSED,
      closedAt: new Date().toISOString(),
    });
  }

  cancel(token: string): KnowledgeVersionSessionRecord {
    const record = this.requireInState(token, [KnowledgeVersionSessionState.OPEN]);
    return this.write({
      ...record,
      state: KnowledgeVersionSessionState.CANCELLED,
      closedAt: new Date().toISOString(),
    });
  }

  expire(token: string): KnowledgeVersionSessionRecord {
    const record = this.require(token);
    return this.write({
      ...record,
      state: KnowledgeVersionSessionState.EXPIRED,
      closedAt: new Date().toISOString(),
    });
  }

  renew(token: string, ttlMs = DEFAULT_SESSION_TTL_MS): KnowledgeVersionSessionRecord {
    const record = this.requireInState(token, [KnowledgeVersionSessionState.OPEN]);
    const now = new Date();
    if (Date.parse(record.expiresAt) <= now.getTime()) {
      throw new VersionLeaseException(
        `Cannot renew Session for Token "${token}": it already expired`,
      );
    }
    return this.write({
      ...record,
      expiresAt: new Date(now.getTime() + ttlMs).toISOString(),
      renewedAt: now.toISOString(),
    });
  }

  get(token: string): KnowledgeVersionSessionRecord | undefined {
    return this.sessionsByToken.get(token);
  }

  require(token: string): KnowledgeVersionSessionRecord {
    const record = this.sessionsByToken.get(token);
    if (!record) {
      throw new VersionSessionException(`No Session is open for Token "${token}"`);
    }
    return record;
  }

  private requireInState(
    token: string,
    allowedStates: readonly KnowledgeVersionSessionState[],
  ): KnowledgeVersionSessionRecord {
    const record = this.require(token);
    if (!allowedStates.includes(record.state)) {
      throw new VersionSessionException(
        `Session for Token "${token}" is "${record.state}" — cannot perform this operation`,
      );
    }
    return record;
  }

  private write(record: KnowledgeVersionSessionRecord): KnowledgeVersionSessionRecord {
    this.sessionsByToken.set(record.token, record);
    return record;
  }
}
