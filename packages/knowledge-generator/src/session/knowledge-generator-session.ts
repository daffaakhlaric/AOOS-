import { KnowledgeGeneratorSessionState } from "../domain/knowledge-generator-session-state.js";
import { GeneratorLeaseException } from "../errors/generator-lease-exception.js";
import { GeneratorSessionException } from "../errors/generator-session-exception.js";
import { generateId } from "../utils/id.js";

import type { KnowledgeGeneratorSessionRecord } from "./knowledge-generator-session-record.js";

const DEFAULT_SESSION_TTL_MS = 15 * 60 * 1000;

/**
 * "KnowledgeGeneratorSession" (docs/PROMPT-005.7K-KNOWLEDGE-GENERATOR.md — "Public
 * API") — one in-memory `Map<token, KnowledgeGeneratorSessionRecord>` implementing the
 * Open/Resume/Close/Cancel/Expire/Renew access-window lifecycle.
 */
export class KnowledgeGeneratorSession {
  private readonly sessionsByToken = new Map<string, KnowledgeGeneratorSessionRecord>();

  open(
    token: string,
    holder: string,
    ttlMs = DEFAULT_SESSION_TTL_MS,
  ): KnowledgeGeneratorSessionRecord {
    if (this.sessionsByToken.has(token)) {
      throw new GeneratorSessionException(`A Session is already open for Token "${token}"`);
    }
    const now = new Date();
    const record: KnowledgeGeneratorSessionRecord = {
      id: generateId(),
      token,
      holder,
      state: KnowledgeGeneratorSessionState.OPEN,
      openedAt: now.toISOString(),
      expiresAt: new Date(now.getTime() + ttlMs).toISOString(),
    };
    this.sessionsByToken.set(token, record);
    return record;
  }

  resume(token: string, ttlMs = DEFAULT_SESSION_TTL_MS): KnowledgeGeneratorSessionRecord {
    const record = this.requireInState(token, [
      KnowledgeGeneratorSessionState.CLOSED,
      KnowledgeGeneratorSessionState.EXPIRED,
    ]);
    const now = new Date();
    return this.write({
      ...record,
      state: KnowledgeGeneratorSessionState.OPEN,
      expiresAt: new Date(now.getTime() + ttlMs).toISOString(),
      closedAt: undefined,
    });
  }

  close(token: string): KnowledgeGeneratorSessionRecord {
    const record = this.requireInState(token, [KnowledgeGeneratorSessionState.OPEN]);
    return this.write({
      ...record,
      state: KnowledgeGeneratorSessionState.CLOSED,
      closedAt: new Date().toISOString(),
    });
  }

  cancel(token: string): KnowledgeGeneratorSessionRecord {
    const record = this.requireInState(token, [KnowledgeGeneratorSessionState.OPEN]);
    return this.write({
      ...record,
      state: KnowledgeGeneratorSessionState.CANCELLED,
      closedAt: new Date().toISOString(),
    });
  }

  expire(token: string): KnowledgeGeneratorSessionRecord {
    const record = this.require(token);
    return this.write({
      ...record,
      state: KnowledgeGeneratorSessionState.EXPIRED,
      closedAt: new Date().toISOString(),
    });
  }

  renew(token: string, ttlMs = DEFAULT_SESSION_TTL_MS): KnowledgeGeneratorSessionRecord {
    const record = this.requireInState(token, [KnowledgeGeneratorSessionState.OPEN]);
    const now = new Date();
    if (Date.parse(record.expiresAt) <= now.getTime()) {
      throw new GeneratorLeaseException(
        `Cannot renew Session for Token "${token}": it already expired`,
      );
    }
    return this.write({
      ...record,
      expiresAt: new Date(now.getTime() + ttlMs).toISOString(),
      renewedAt: now.toISOString(),
    });
  }

  get(token: string): KnowledgeGeneratorSessionRecord | undefined {
    return this.sessionsByToken.get(token);
  }

  require(token: string): KnowledgeGeneratorSessionRecord {
    const record = this.sessionsByToken.get(token);
    if (!record) {
      throw new GeneratorSessionException(`No Session is open for Token "${token}"`);
    }
    return record;
  }

  private requireInState(
    token: string,
    allowedStates: readonly KnowledgeGeneratorSessionState[],
  ): KnowledgeGeneratorSessionRecord {
    const record = this.require(token);
    if (!allowedStates.includes(record.state)) {
      throw new GeneratorSessionException(
        `Session for Token "${token}" is "${record.state}" — cannot perform this operation`,
      );
    }
    return record;
  }

  private write(record: KnowledgeGeneratorSessionRecord): KnowledgeGeneratorSessionRecord {
    this.sessionsByToken.set(record.token, record);
    return record;
  }
}
