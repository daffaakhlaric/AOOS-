import type { IProviderPermissionChecker } from "../permission/i-provider-permission-checker.js";

export interface KnowledgeProviderConfig {
  readonly permissionChecker?: IProviderPermissionChecker;
}
