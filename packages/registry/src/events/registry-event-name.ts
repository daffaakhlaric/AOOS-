/** Named Registry System events (docs/PROMPT-005.3-REGISTRY-SYSTEM.md). */
export enum RegistryEventName {
  REGISTRY_LOADED = "registry.loaded",
  REGISTRY_RELOADED = "registry.reloaded",
  REGISTRY_UPDATED = "registry.updated",
  REGISTRY_REMOVED = "registry.removed",
  VALIDATION_FAILED = "registry.validation_failed",
  DEPENDENCY_FAILED = "registry.dependency_failed",
}
