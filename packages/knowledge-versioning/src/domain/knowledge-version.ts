import type { KnowledgeVersionConfigurationRecord } from "../configuration/knowledge-version-configuration-record.js";
import type { KnowledgeVersionContext } from "../context/knowledge-version-context.js";
import type { IKnowledgeVersion } from "../contracts/i-knowledge-version.js";

import type { KnowledgeHistoryEntry } from "./knowledge-history.js";
import type { KnowledgeVersionAuditEntry } from "./knowledge-version-audit.js";
import type { KnowledgeVersionExecution } from "./knowledge-version-execution.js";
import type { KnowledgeVersionLogEntry } from "./knowledge-version-log.js";
import type { KnowledgeVersionMetadata } from "./knowledge-version-metadata.js";
import type { KnowledgeVersionState } from "./knowledge-version-state.js";
import type { KnowledgeVersionType } from "./knowledge-version-type.js";

/**
 * "KnowledgeVersion" (docs/PROMPT-005.7H-KNOWLEDGE-VERSIONING.md — "Public API" AND
 * "Domain Model") — the concrete, read-only view over one version's
 * `KnowledgeVersionExecution`. Every `KnowledgeVersioning` operation that hands a
 * version back to a caller returns one of these rather than the raw execution envelope.
 */
export class KnowledgeVersion implements IKnowledgeVersion {
  constructor(private readonly execution: KnowledgeVersionExecution) {}

  get id(): string {
    return this.execution.instance.id;
  }

  get token(): string {
    return this.execution.instance.token;
  }

  get versionId(): string {
    return this.execution.metadata.versionId;
  }

  get assetId(): string {
    return this.execution.metadata.assetId;
  }

  get versionType(): KnowledgeVersionType {
    return this.execution.metadata.versionType;
  }

  get versionNumber(): string {
    return this.execution.metadata.versionNumber;
  }

  get branchId(): string | undefined {
    return this.execution.metadata.branchId;
  }

  get state(): KnowledgeVersionState {
    return this.execution.instance.state;
  }

  get metadata(): KnowledgeVersionMetadata {
    return this.execution.metadata;
  }

  get configuration(): KnowledgeVersionConfigurationRecord {
    return this.execution.configuration;
  }

  get context(): KnowledgeVersionContext {
    return this.execution.context;
  }

  get history(): readonly KnowledgeHistoryEntry[] {
    return this.execution.history;
  }

  get auditTrail(): readonly KnowledgeVersionAuditEntry[] {
    return this.execution.auditTrail;
  }

  get logs(): readonly KnowledgeVersionLogEntry[] {
    return this.execution.logs;
  }

  toExecution(): KnowledgeVersionExecution {
    return this.execution;
  }
}
