import { RuntimeLeaseException } from "../errors/runtime-lease-exception.js";
import { RuntimeSessionException } from "../errors/runtime-session-exception.js";
import { generateId } from "../utils/id.js";

import type { KnowledgeRuntimeSessionRecord } from "./knowledge-runtime-session-record.js";
import { KnowledgeRuntimeSessionState } from "./knowledge-runtime-session-state.js";

const DEFAULT_SESSION_TTL_MS = 15 * 60 * 1000;

/**
 * "RUNTIME SESSION ... Supports Open, Close, Suspend, Resume, Renew, Expire, Destroy. No
 * persistence." (docs/PROMPT-005.7B-KNOWLEDGE-RUNTIME.md) — one in-memory
 * `Map<instanceToken, KnowledgeRuntimeSessionRecord>` per Session holder. Distinct from
 * `KnowledgeRuntimeStateMachine`: a Session tracks an access window over an Instance, not
 * the Instance's own execution state.
 */
export class KnowledgeRuntimeSession {
  private readonly sessionsByToken = new Map<string, KnowledgeRuntimeSessionRecord>();

  open(
    instanceToken: string,
    holder: string,
    ttlMs = DEFAULT_SESSION_TTL_MS,
  ): KnowledgeRuntimeSessionRecord {
    if (this.sessionsByToken.has(instanceToken)) {
      throw new RuntimeSessionException(
        `A Session is already open for Instance Token "${instanceToken}"`,
      );
    }
    const now = new Date();
    const record: KnowledgeRuntimeSessionRecord = {
      id: generateId(),
      instanceToken,
      state: KnowledgeRuntimeSessionState.OPEN,
      lease: {
        id: generateId(),
        token: instanceToken,
        holder,
        acquiredAt: now.toISOString(),
        expiresAt: new Date(now.getTime() + ttlMs).toISOString(),
      },
      openedAt: now.toISOString(),
    };
    this.sessionsByToken.set(instanceToken, record);
    return record;
  }

  close(instanceToken: string): KnowledgeRuntimeSessionRecord {
    const record = this.requireOpenable(instanceToken, [
      KnowledgeRuntimeSessionState.OPEN,
      KnowledgeRuntimeSessionState.SUSPENDED,
    ]);
    return this.write({
      ...record,
      state: KnowledgeRuntimeSessionState.CLOSED,
      closedAt: new Date().toISOString(),
    });
  }

  suspend(instanceToken: string): KnowledgeRuntimeSessionRecord {
    const record = this.requireOpenable(instanceToken, [KnowledgeRuntimeSessionState.OPEN]);
    return this.write({ ...record, state: KnowledgeRuntimeSessionState.SUSPENDED });
  }

  resume(instanceToken: string): KnowledgeRuntimeSessionRecord {
    const record = this.requireOpenable(instanceToken, [KnowledgeRuntimeSessionState.SUSPENDED]);
    return this.write({ ...record, state: KnowledgeRuntimeSessionState.OPEN });
  }

  renew(instanceToken: string, ttlMs = DEFAULT_SESSION_TTL_MS): KnowledgeRuntimeSessionRecord {
    const record = this.requireOpenable(instanceToken, [
      KnowledgeRuntimeSessionState.OPEN,
      KnowledgeRuntimeSessionState.SUSPENDED,
    ]);
    const now = new Date();
    if (Date.parse(record.lease.expiresAt) <= now.getTime()) {
      throw new RuntimeLeaseException(
        `Cannot renew Session for Instance Token "${instanceToken}": its Lease already expired`,
      );
    }
    return this.write({
      ...record,
      lease: { ...record.lease, expiresAt: new Date(now.getTime() + ttlMs).toISOString() },
      renewedAt: now.toISOString(),
    });
  }

  expire(instanceToken: string): KnowledgeRuntimeSessionRecord {
    const record = this.require(instanceToken);
    return this.write({
      ...record,
      state: KnowledgeRuntimeSessionState.EXPIRED,
      closedAt: new Date().toISOString(),
    });
  }

  destroy(instanceToken: string): void {
    this.require(instanceToken);
    this.sessionsByToken.delete(instanceToken);
  }

  get(instanceToken: string): KnowledgeRuntimeSessionRecord | undefined {
    return this.sessionsByToken.get(instanceToken);
  }

  require(instanceToken: string): KnowledgeRuntimeSessionRecord {
    const record = this.sessionsByToken.get(instanceToken);
    if (!record) {
      throw new RuntimeSessionException(`No Session is open for Instance Token "${instanceToken}"`);
    }
    return record;
  }

  private requireOpenable(
    instanceToken: string,
    allowedStates: readonly KnowledgeRuntimeSessionState[],
  ): KnowledgeRuntimeSessionRecord {
    const record = this.require(instanceToken);
    if (!allowedStates.includes(record.state)) {
      throw new RuntimeSessionException(
        `Session for Instance Token "${instanceToken}" is "${record.state}" — cannot perform this operation`,
      );
    }
    return record;
  }

  private write(record: KnowledgeRuntimeSessionRecord): KnowledgeRuntimeSessionRecord {
    this.sessionsByToken.set(record.instanceToken, record);
    return record;
  }
}
