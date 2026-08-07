import { EmbeddingSessionState } from "../domain/embedding-session-state.js";
import { EmbeddingSessionException } from "../errors/embedding-session-exception.js";
import { generateId } from "../utils/id.js";

import type { EmbeddingSessionLedgerRecord } from "./embedding-session-record.js";

const DEFAULT_SESSION_TTL_MS = 15 * 60 * 1000;

/**
 * "EmbeddingSession" (docs/PROMPT-005.7N-EMBEDDING-MANAGER.md — "Public API") — one
 * in-memory `Map<token, EmbeddingSessionLedgerRecord>` implementing the
 * Open/Resume/Close/Cancel/Expire/Renew access-window lifecycle.
 */
export class EmbeddingSession {
  private readonly sessionsByToken = new Map<string, EmbeddingSessionLedgerRecord>();

  open(
    token: string,
    holder: string,
    ttlMs = DEFAULT_SESSION_TTL_MS,
  ): EmbeddingSessionLedgerRecord {
    if (this.sessionsByToken.has(token)) {
      throw new EmbeddingSessionException(`A Session is already open for Token "${token}"`);
    }
    const now = new Date();
    const record: EmbeddingSessionLedgerRecord = {
      id: generateId(),
      token,
      holder,
      state: EmbeddingSessionState.OPEN,
      openedAt: now.toISOString(),
      expiresAt: new Date(now.getTime() + ttlMs).toISOString(),
    };
    this.sessionsByToken.set(token, record);
    return record;
  }

  resume(token: string, ttlMs = DEFAULT_SESSION_TTL_MS): EmbeddingSessionLedgerRecord {
    const record = this.requireInState(token, [
      EmbeddingSessionState.CLOSED,
      EmbeddingSessionState.EXPIRED,
    ]);
    const now = new Date();
    return this.write({
      ...record,
      state: EmbeddingSessionState.OPEN,
      expiresAt: new Date(now.getTime() + ttlMs).toISOString(),
      closedAt: undefined,
    });
  }

  close(token: string): EmbeddingSessionLedgerRecord {
    const record = this.requireInState(token, [EmbeddingSessionState.OPEN]);
    return this.write({
      ...record,
      state: EmbeddingSessionState.CLOSED,
      closedAt: new Date().toISOString(),
    });
  }

  cancel(token: string): EmbeddingSessionLedgerRecord {
    const record = this.requireInState(token, [EmbeddingSessionState.OPEN]);
    return this.write({
      ...record,
      state: EmbeddingSessionState.CANCELLED,
      closedAt: new Date().toISOString(),
    });
  }

  expire(token: string): EmbeddingSessionLedgerRecord {
    const record = this.require(token);
    return this.write({
      ...record,
      state: EmbeddingSessionState.EXPIRED,
      closedAt: new Date().toISOString(),
    });
  }

  renew(token: string, ttlMs = DEFAULT_SESSION_TTL_MS): EmbeddingSessionLedgerRecord {
    const record = this.requireInState(token, [EmbeddingSessionState.OPEN]);
    const now = new Date();
    if (Date.parse(record.expiresAt) <= now.getTime()) {
      throw new EmbeddingSessionException(
        `Cannot renew Session for Token "${token}": it already expired`,
      );
    }
    return this.write({
      ...record,
      expiresAt: new Date(now.getTime() + ttlMs).toISOString(),
      renewedAt: now.toISOString(),
    });
  }

  get(token: string): EmbeddingSessionLedgerRecord | undefined {
    return this.sessionsByToken.get(token);
  }

  require(token: string): EmbeddingSessionLedgerRecord {
    const record = this.sessionsByToken.get(token);
    if (!record) {
      throw new EmbeddingSessionException(`No Session is open for Token "${token}"`);
    }
    return record;
  }

  private requireInState(
    token: string,
    allowedStates: readonly EmbeddingSessionState[],
  ): EmbeddingSessionLedgerRecord {
    const record = this.require(token);
    if (!allowedStates.includes(record.state)) {
      throw new EmbeddingSessionException(
        `Session for Token "${token}" is "${record.state}" — cannot perform this operation`,
      );
    }
    return record;
  }

  private write(record: EmbeddingSessionLedgerRecord): EmbeddingSessionLedgerRecord {
    this.sessionsByToken.set(record.token, record);
    return record;
  }
}
