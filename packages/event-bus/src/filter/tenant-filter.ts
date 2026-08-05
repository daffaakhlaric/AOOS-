import type { BaseEventShape } from "../contracts/base-event.js";

import type { IEventFilter } from "./i-filter.js";

/** Tenant Filter — accepts platform-scoped events (no `tenantId`) always; tenant-scoped events only for allowed tenants. */
export class TenantFilter implements IEventFilter {
  readonly name = "tenant";

  constructor(private readonly allowedTenantIds: ReadonlySet<string>) {}

  accepts(event: BaseEventShape): boolean {
    return event.tenantId === undefined || this.allowedTenantIds.has(event.tenantId);
  }
}
