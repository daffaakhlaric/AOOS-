import type { IKnowledgeSynchronizationChangeDetector } from "../contracts/i-knowledge-synchronization-change-detector.js";
import type { IKnowledgeSynchronizationCommitter } from "../contracts/i-knowledge-synchronization-committer.js";
import type { IKnowledgeSynchronizationRetryStrategy } from "../contracts/i-knowledge-synchronization-retry-strategy.js";
import type { IKnowledgeSynchronizationScheduler } from "../contracts/i-knowledge-synchronization-scheduler.js";
import type { ISynchronizationPermissionChecker } from "../permission/i-synchronization-permission-checker.js";

export interface KnowledgeSynchronizationConfig {
  readonly permissionChecker?: ISynchronizationPermissionChecker;
  readonly committer?: IKnowledgeSynchronizationCommitter;
  readonly changeDetector?: IKnowledgeSynchronizationChangeDetector;
  readonly retryStrategy?: IKnowledgeSynchronizationRetryStrategy;
  readonly externalScheduler?: IKnowledgeSynchronizationScheduler;
}
