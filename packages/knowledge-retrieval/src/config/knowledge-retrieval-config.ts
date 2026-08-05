import type { IQueryPermissionChecker } from "../permission/i-query-permission-checker.js";
import type { IResultPermissionChecker } from "../permission/i-result-permission-checker.js";
import type { IQueryPolicyChecker } from "../policy/i-query-policy-checker.js";

export interface KnowledgeRetrievalConfig {
  readonly queryPermissionChecker?: IQueryPermissionChecker;
  readonly resultPermissionChecker?: IResultPermissionChecker;
  readonly queryPolicyChecker?: IQueryPolicyChecker;
}
