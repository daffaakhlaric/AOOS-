import { z } from "zod";

import { baseManifestSchema } from "../../contracts/base-manifest.js";
import { RegistryKind } from "../../contracts/registry-kind.js";
import type { RegistryEventEmitter } from "../../events/registry-event-emitter.js";
import { Registry } from "../registry.js";

export const analyticsManifestSchema = baseManifestSchema.extend({
  metric_refs: z.array(z.string()).optional(),
  dashboard_ref: z.string().optional(),
});

export type AnalyticsManifest = z.infer<typeof analyticsManifestSchema>;

export function createAnalyticsRegistry(
  events?: RegistryEventEmitter,
): Registry<AnalyticsManifest> {
  return new Registry<AnalyticsManifest>({
    kind: RegistryKind.ANALYTICS,
    schema: analyticsManifestSchema,
    events,
  });
}
