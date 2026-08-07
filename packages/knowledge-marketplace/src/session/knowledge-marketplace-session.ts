import { MarketplaceLeaseException } from "../errors/marketplace-lease-exception.js";
import { MarketplaceSessionException } from "../errors/marketplace-session-exception.js";
import { generateId } from "../utils/id.js";

import type { KnowledgeMarketplaceSessionRecord } from "./knowledge-marketplace-session-record.js";
import { KnowledgeMarketplaceSessionState } from "./knowledge-marketplace-session-state.js";

const DEFAULT_SESSION_TTL_MS = 15 * 60 * 1000;

/**
 * "KnowledgeMarketplaceSession" (docs/PROMPT-005.7J-KNOWLEDGE-MARKETPLACE.md — "Public
 * API") — one in-memory `Map<token, KnowledgeMarketplaceSessionRecord>` implementing the
 * Open/Resume/Close/Cancel/Expire/Renew access-window lifecycle.
 */
export class KnowledgeMarketplaceSession {
  private readonly sessionsByToken = new Map<string, KnowledgeMarketplaceSessionRecord>();

  open(
    token: string,
    holder: string,
    ttlMs = DEFAULT_SESSION_TTL_MS,
  ): KnowledgeMarketplaceSessionRecord {
    if (this.sessionsByToken.has(token)) {
      throw new MarketplaceSessionException(`A Session is already open for Token "${token}"`);
    }
    const now = new Date();
    const record: KnowledgeMarketplaceSessionRecord = {
      id: generateId(),
      token,
      holder,
      state: KnowledgeMarketplaceSessionState.OPEN,
      openedAt: now.toISOString(),
      expiresAt: new Date(now.getTime() + ttlMs).toISOString(),
    };
    this.sessionsByToken.set(token, record);
    return record;
  }

  resume(token: string, ttlMs = DEFAULT_SESSION_TTL_MS): KnowledgeMarketplaceSessionRecord {
    const record = this.requireInState(token, [
      KnowledgeMarketplaceSessionState.CLOSED,
      KnowledgeMarketplaceSessionState.EXPIRED,
    ]);
    const now = new Date();
    return this.write({
      ...record,
      state: KnowledgeMarketplaceSessionState.OPEN,
      expiresAt: new Date(now.getTime() + ttlMs).toISOString(),
      closedAt: undefined,
    });
  }

  close(token: string): KnowledgeMarketplaceSessionRecord {
    const record = this.requireInState(token, [KnowledgeMarketplaceSessionState.OPEN]);
    return this.write({
      ...record,
      state: KnowledgeMarketplaceSessionState.CLOSED,
      closedAt: new Date().toISOString(),
    });
  }

  cancel(token: string): KnowledgeMarketplaceSessionRecord {
    const record = this.requireInState(token, [KnowledgeMarketplaceSessionState.OPEN]);
    return this.write({
      ...record,
      state: KnowledgeMarketplaceSessionState.CANCELLED,
      closedAt: new Date().toISOString(),
    });
  }

  expire(token: string): KnowledgeMarketplaceSessionRecord {
    const record = this.require(token);
    return this.write({
      ...record,
      state: KnowledgeMarketplaceSessionState.EXPIRED,
      closedAt: new Date().toISOString(),
    });
  }

  renew(token: string, ttlMs = DEFAULT_SESSION_TTL_MS): KnowledgeMarketplaceSessionRecord {
    const record = this.requireInState(token, [KnowledgeMarketplaceSessionState.OPEN]);
    const now = new Date();
    if (Date.parse(record.expiresAt) <= now.getTime()) {
      throw new MarketplaceLeaseException(
        `Cannot renew Session for Token "${token}": it already expired`,
      );
    }
    return this.write({
      ...record,
      expiresAt: new Date(now.getTime() + ttlMs).toISOString(),
      renewedAt: now.toISOString(),
    });
  }

  get(token: string): KnowledgeMarketplaceSessionRecord | undefined {
    return this.sessionsByToken.get(token);
  }

  require(token: string): KnowledgeMarketplaceSessionRecord {
    const record = this.sessionsByToken.get(token);
    if (!record) {
      throw new MarketplaceSessionException(`No Session is open for Token "${token}"`);
    }
    return record;
  }

  private requireInState(
    token: string,
    allowedStates: readonly KnowledgeMarketplaceSessionState[],
  ): KnowledgeMarketplaceSessionRecord {
    const record = this.require(token);
    if (!allowedStates.includes(record.state)) {
      throw new MarketplaceSessionException(
        `Session for Token "${token}" is "${record.state}" — cannot perform this operation`,
      );
    }
    return record;
  }

  private write(record: KnowledgeMarketplaceSessionRecord): KnowledgeMarketplaceSessionRecord {
    this.sessionsByToken.set(record.token, record);
    return record;
  }
}
