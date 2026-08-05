import type { IsoDateTime, Uuid } from "@aos/types";

/** Anything with a stable identity — mirrors every Contract's `id` field (docs/003.5-CONTRACT-FIRST-DESIGN.md). */
export interface Identifiable {
  readonly id: Uuid;
}

/** Anything with creation/update timestamps. */
export interface Timestamped {
  readonly createdAt: IsoDateTime;
  readonly updatedAt: IsoDateTime;
}

/** Anything scoped to a single tenant — mirrors DDD §25 Tenant Isolation, Constitution RULE-016/017. */
export interface TenantScoped {
  readonly tenantId: Uuid<"TenantId">;
}

/** Anything with a SemVer-style version — mirrors every Contract's `version` field. */
export interface Versioned {
  readonly version: string;
}

/** Anything carrying a distributed-tracing correlation identifier (Constitution §17 Logging Standards). */
export interface Traceable {
  readonly traceId: string;
  readonly correlationId?: string;
}
