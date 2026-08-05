import { z } from "zod";

import { baseManifestSchema } from "../../contracts/base-manifest.js";
import { RegistryKind } from "../../contracts/registry-kind.js";
import type { RegistryEventEmitter } from "../../events/registry-event-emitter.js";
import { Registry } from "../registry.js";

/**
 * Solution Pack manifest (docs/PROMPT-005.3A-REGISTRY-ENHANCEMENT.md Enhancement 3).
 * Examples: Automotive Pack, Leasing Pack, Insurance Pack, Property Pack, Healthcare Pack,
 * Retail Pack, Hospitality Pack, Education Pack. A bundled, installable composition of
 * Agents/Workflows/Tools/Capabilities/Prompts/Dashboards/Permissions/Policies — no
 * Marketplace and no Installer exist yet; this is manifest metadata only.
 */
export const solutionPackManifestSchema = baseManifestSchema.extend({
  /** Industry Registry entry id(s) this pack targets — cross-checked against the Industry Registry. */
  industry: z.array(z.string()).min(1),
  agents: z.array(z.string()).optional(),
  workflows: z.array(z.string()).optional(),
  tools: z.array(z.string()).optional(),
  capabilities: z.array(z.string()).optional(),
  prompts: z.array(z.string()).optional(),
  dashboards: z.array(z.string()).optional(),
  permission_list: z.array(z.string()).optional(),
  policies: z.array(z.string()).optional(),
  license: z.string().optional(),
  publisher: z.string().optional(),
});

export type SolutionPackManifest = z.infer<typeof solutionPackManifestSchema>;

export function createSolutionPackRegistry(
  events?: RegistryEventEmitter,
): Registry<SolutionPackManifest> {
  return new Registry<SolutionPackManifest>({
    kind: RegistryKind.SOLUTION_PACK,
    schema: solutionPackManifestSchema,
    events,
  });
}
