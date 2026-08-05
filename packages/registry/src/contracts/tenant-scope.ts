/** Mirrors the Agent Contract's `tenant_scope` field (docs/003.5-CONTRACT-FIRST-DESIGN.md §2), generalized. */
export enum TenantScope {
  GLOBAL = "global",
  TENANT_OVERRIDE_ALLOWED = "tenant_override_allowed",
  TENANT_ONLY = "tenant_only",
}

/** Manifest source formats supported by the Loader (docs/PROMPT-005.3-REGISTRY-SYSTEM.md — YAML/JSON/TS now, Remote reserved). */
export enum ManifestFormat {
  YAML = "yaml",
  JSON = "json",
  TYPESCRIPT = "typescript",
}
