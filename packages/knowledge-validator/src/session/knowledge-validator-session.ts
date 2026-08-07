import { KnowledgeValidationSessionState } from "../domain/knowledge-validation-session-state.js";
import { ValidatorLeaseException } from "../errors/validator-lease-exception.js";
import { ValidatorSessionException } from "../errors/validator-session-exception.js";
import { generateId } from "../utils/id.js";

import type { KnowledgeValidatorSessionRecord } from "./knowledge-validator-session-record.js";

const DEFAULT_SESSION_TTL_MS = 15 * 60 * 1000;

/**
 * "KnowledgeValidatorSession" (docs/PROMPT-005.7M-KNOWLEDGE-VALIDATOR.md — "Public
 * API") — one in-memory `Map<token, KnowledgeValidatorSessionRecord>` implementing the
 * Open/Resume/Close/Cancel/Expire/Renew access-window lifecycle.
 */
export class KnowledgeValidatorSession {
  private readonly sessionsByToken = new Map<string, KnowledgeValidatorSessionRecord>();

  open(
    token: string,
    holder: string,
    ttlMs = DEFAULT_SESSION_TTL_MS,
  ): KnowledgeValidatorSessionRecord {
    if (this.sessionsByToken.has(token)) {
      throw new ValidatorSessionException(`A Session is already open for Token "${token}"`);
    }
    const now = new Date();
    const record: KnowledgeValidatorSessionRecord = {
      id: generateId(),
      token,
      holder,
      state: KnowledgeValidationSessionState.OPEN,
      openedAt: now.toISOString(),
      expiresAt: new Date(now.getTime() + ttlMs).toISOString(),
    };
    this.sessionsByToken.set(token, record);
    return record;
  }

  resume(token: string, ttlMs = DEFAULT_SESSION_TTL_MS): KnowledgeValidatorSessionRecord {
    const record = this.requireInState(token, [
      KnowledgeValidationSessionState.CLOSED,
      KnowledgeValidationSessionState.EXPIRED,
    ]);
    const now = new Date();
    return this.write({
      ...record,
      state: KnowledgeValidationSessionState.OPEN,
      expiresAt: new Date(now.getTime() + ttlMs).toISOString(),
      closedAt: undefined,
    });
  }

  close(token: string): KnowledgeValidatorSessionRecord {
    const record = this.requireInState(token, [KnowledgeValidationSessionState.OPEN]);
    return this.write({
      ...record,
      state: KnowledgeValidationSessionState.CLOSED,
      closedAt: new Date().toISOString(),
    });
  }

  cancel(token: string): KnowledgeValidatorSessionRecord {
    const record = this.requireInState(token, [KnowledgeValidationSessionState.OPEN]);
    return this.write({
      ...record,
      state: KnowledgeValidationSessionState.CANCELLED,
      closedAt: new Date().toISOString(),
    });
  }

  expire(token: string): KnowledgeValidatorSessionRecord {
    const record = this.require(token);
    return this.write({
      ...record,
      state: KnowledgeValidationSessionState.EXPIRED,
      closedAt: new Date().toISOString(),
    });
  }

  renew(token: string, ttlMs = DEFAULT_SESSION_TTL_MS): KnowledgeValidatorSessionRecord {
    const record = this.requireInState(token, [KnowledgeValidationSessionState.OPEN]);
    const now = new Date();
    if (Date.parse(record.expiresAt) <= now.getTime()) {
      throw new ValidatorLeaseException(
        `Cannot renew Session for Token "${token}": it already expired`,
      );
    }
    return this.write({
      ...record,
      expiresAt: new Date(now.getTime() + ttlMs).toISOString(),
      renewedAt: now.toISOString(),
    });
  }

  get(token: string): KnowledgeValidatorSessionRecord | undefined {
    return this.sessionsByToken.get(token);
  }

  require(token: string): KnowledgeValidatorSessionRecord {
    const record = this.sessionsByToken.get(token);
    if (!record) {
      throw new ValidatorSessionException(`No Session is open for Token "${token}"`);
    }
    return record;
  }

  private requireInState(
    token: string,
    allowedStates: readonly KnowledgeValidationSessionState[],
  ): KnowledgeValidatorSessionRecord {
    const record = this.require(token);
    if (!allowedStates.includes(record.state)) {
      throw new ValidatorSessionException(
        `Session for Token "${token}" is "${record.state}" — cannot perform this operation`,
      );
    }
    return record;
  }

  private write(record: KnowledgeValidatorSessionRecord): KnowledgeValidatorSessionRecord {
    this.sessionsByToken.set(record.token, record);
    return record;
  }
}
