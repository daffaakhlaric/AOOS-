import { z } from "zod";

import { baseManifestSchema } from "../../contracts/base-manifest.js";
import { RegistryKind } from "../../contracts/registry-kind.js";
import type { RegistryEventEmitter } from "../../events/registry-event-emitter.js";
import { Registry } from "../registry.js";

export const tenantManifestSchema = baseManifestSchema.extend({
  plan_tier: z.enum(["shared", "schema_per_tenant", "database_per_tenant"]),
  region: z.string().optional(),
});

export type TenantManifest = z.infer<typeof tenantManifestSchema>;

export function createTenantRegistry(events?: RegistryEventEmitter): Registry<TenantManifest> {
  return new Registry<TenantManifest>({
    kind: RegistryKind.TENANT,
    schema: tenantManifestSchema,
    events,
  });
}
