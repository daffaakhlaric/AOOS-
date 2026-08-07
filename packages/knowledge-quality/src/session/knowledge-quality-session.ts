import { KnowledgeQualitySessionState } from "../domain/knowledge-quality-session-state.js";
import { QualityLeaseException } from "../errors/quality-lease-exception.js";
import { QualitySessionException } from "../errors/quality-session-exception.js";
import { generateId } from "../utils/id.js";

import type { KnowledgeQualitySessionRecord } from "./knowledge-quality-session-record.js";

const DEFAULT_SESSION_TTL_MS = 15 * 60 * 1000;

/**
 * "KnowledgeQualitySession" (docs/PROMPT-005.7L-KNOWLEDGE-QUALITY.md — "Public
 * API") — one in-memory `Map<token, KnowledgeQualitySessionRecord>` implementing the
 * Open/Resume/Close/Cancel/Expire/Renew access-window lifecycle.
 */
export class KnowledgeQualitySession {
  private readonly sessionsByToken = new Map<string, KnowledgeQualitySessionRecord>();

  open(
    token: string,
    holder: string,
    ttlMs = DEFAULT_SESSION_TTL_MS,
  ): KnowledgeQualitySessionRecord {
    if (this.sessionsByToken.has(token)) {
      throw new QualitySessionException(`A Session is already open for Token "${token}"`);
    }
    const now = new Date();
    const record: KnowledgeQualitySessionRecord = {
      id: generateId(),
      token,
      holder,
      state: KnowledgeQualitySessionState.OPEN,
      openedAt: now.toISOString(),
      expiresAt: new Date(now.getTime() + ttlMs).toISOString(),
    };
    this.sessionsByToken.set(token, record);
    return record;
  }

  resume(token: string, ttlMs = DEFAULT_SESSION_TTL_MS): KnowledgeQualitySessionRecord {
    const record = this.requireInState(token, [
      KnowledgeQualitySessionState.CLOSED,
      KnowledgeQualitySessionState.EXPIRED,
    ]);
    const now = new Date();
    return this.write({
      ...record,
      state: KnowledgeQualitySessionState.OPEN,
      expiresAt: new Date(now.getTime() + ttlMs).toISOString(),
      closedAt: undefined,
    });
  }

  close(token: string): KnowledgeQualitySessionRecord {
    const record = this.requireInState(token, [KnowledgeQualitySessionState.OPEN]);
    return this.write({
      ...record,
      state: KnowledgeQualitySessionState.CLOSED,
      closedAt: new Date().toISOString(),
    });
  }

  cancel(token: string): KnowledgeQualitySessionRecord {
    const record = this.requireInState(token, [KnowledgeQualitySessionState.OPEN]);
    return this.write({
      ...record,
      state: KnowledgeQualitySessionState.CANCELLED,
      closedAt: new Date().toISOString(),
    });
  }

  expire(token: string): KnowledgeQualitySessionRecord {
    const record = this.require(token);
    return this.write({
      ...record,
      state: KnowledgeQualitySessionState.EXPIRED,
      closedAt: new Date().toISOString(),
    });
  }

  renew(token: string, ttlMs = DEFAULT_SESSION_TTL_MS): KnowledgeQualitySessionRecord {
    const record = this.requireInState(token, [KnowledgeQualitySessionState.OPEN]);
    const now = new Date();
    if (Date.parse(record.expiresAt) <= now.getTime()) {
      throw new QualityLeaseException(
        `Cannot renew Session for Token "${token}": it already expired`,
      );
    }
    return this.write({
      ...record,
      expiresAt: new Date(now.getTime() + ttlMs).toISOString(),
      renewedAt: now.toISOString(),
    });
  }

  get(token: string): KnowledgeQualitySessionRecord | undefined {
    return this.sessionsByToken.get(token);
  }

  require(token: string): KnowledgeQualitySessionRecord {
    const record = this.sessionsByToken.get(token);
    if (!record) {
      throw new QualitySessionException(`No Session is open for Token "${token}"`);
    }
    return record;
  }

  private requireInState(
    token: string,
    allowedStates: readonly KnowledgeQualitySessionState[],
  ): KnowledgeQualitySessionRecord {
    const record = this.require(token);
    if (!allowedStates.includes(record.state)) {
      throw new QualitySessionException(
        `Session for Token "${token}" is "${record.state}" — cannot perform this operation`,
      );
    }
    return record;
  }

  private write(record: KnowledgeQualitySessionRecord): KnowledgeQualitySessionRecord {
    this.sessionsByToken.set(record.token, record);
    return record;
  }
}
