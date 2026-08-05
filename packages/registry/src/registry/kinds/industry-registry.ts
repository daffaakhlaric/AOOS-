import { z } from "zod";

import { baseManifestSchema } from "../../contracts/base-manifest.js";
import { RegistryKind } from "../../contracts/registry-kind.js";
import type { RegistryEventEmitter } from "../../events/registry-event-emitter.js";
import { Registry } from "../registry.js";

/**
 * Industry manifest — the parent of Solution Pack (docs/PROMPT-005.3A-REGISTRY-ENHANCEMENT.md
 * Enhancement 4). Examples: Automotive, Leasing, Property, Insurance, Healthcare, Retail,
 * Manufacturing, Education, Hospitality, General Business.
 */
export const industryManifestSchema = baseManifestSchema.extend({
  /** Parent Industry Registry entry id, for hierarchical industries (e.g. "leasing" under "automotive"). */
  parent_industry: z.string().optional(),
});

export type IndustryManifest = z.infer<typeof industryManifestSchema>;

export function createIndustryRegistry(events?: RegistryEventEmitter): Registry<IndustryManifest> {
  return new Registry<IndustryManifest>({
    kind: RegistryKind.INDUSTRY,
    schema: industryManifestSchema,
    events,
  });
}
