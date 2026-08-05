import { z } from "zod";

import { baseManifestSchema } from "../../contracts/base-manifest.js";
import {
  extractCapabilityNamespace,
  isValidCapabilityNamespace,
} from "../../contracts/capability-namespace.js";
import { RegistryKind } from "../../contracts/registry-kind.js";
import type { RegistryEventEmitter } from "../../events/registry-event-emitter.js";
import type { BusinessRule } from "../../validators/business-validator.js";
import { Registry } from "../registry.js";

/**
 * Capability manifest — "Capability adalah bahasa universal seluruh Agent. Capability
 * BUKAN Tool. Capability BUKAN Connector. Capability BUKAN Workflow."
 * (docs/PROMPT-005.3A-REGISTRY-ENHANCEMENT.md Enhancement 1). `provided_by` fulfils the
 * "Provider List" field (ids of the Tool/Connector entries that implement this Capability —
 * cross-checked against the Tool Registry via bootstrap/cross-reference-map.ts).
 * Owner/Category/Industry/Tags/Metadata are inherited from `baseManifestSchema`; Status
 * lives on the `RegistryEntry` envelope, not the manifest, to keep a single source of truth.
 */
export const capabilityManifestSchema = baseManifestSchema.extend({
  description: z.string().min(1),
  /** Dot-prefix namespace this capability id belongs to (e.g. "inventory") — validated against contracts/capability-namespace.ts. */
  namespace: z.string().min(1).optional(),
  /** Reference to the input contract (e.g. a Contract-First schema id) — no runtime enforcement here. */
  input_schema: z.string().optional(),
  /** Reference to the output contract — no runtime enforcement here. */
  output_schema: z.string().optional(),
  /** Ids of Tool/Connector Registry entries that can execute this Capability ("Provider List"). */
  provided_by: z.array(z.string()).optional(),
  /** Maturity of the capability description itself, distinct from the entry's registration `status`. */
  lifecycle: z.enum(["experimental", "stable", "deprecated"]).optional(),
});

export type CapabilityManifest = z.infer<typeof capabilityManifestSchema>;

/**
 * Enforces Enhancement 5 (Capability Namespace): when `namespace` is set it must be one of
 * the formal `CAPABILITY_NAMESPACES`, and it must match the id's own dot-prefix (an id of
 * "inventory.read" cannot declare `namespace: "crm"`).
 */
export const capabilityNamespaceRule: BusinessRule<CapabilityManifest> = (manifest) => {
  const idNamespace = extractCapabilityNamespace(manifest.id);
  const issues: { path: string; message: string }[] = [];

  if (!isValidCapabilityNamespace(manifest.id)) {
    issues.push({
      path: "id",
      message: `Capability id "${manifest.id}" must start with a known namespace (one of the CAPABILITY_NAMESPACES), got "${idNamespace}"`,
    });
  }
  if (manifest.namespace !== undefined && manifest.namespace !== idNamespace) {
    issues.push({
      path: "namespace",
      message: `Capability "${manifest.id}": declared namespace "${manifest.namespace}" does not match the id's own namespace "${idNamespace}"`,
    });
  }

  return issues;
};

export function createCapabilityRegistry(
  events?: RegistryEventEmitter,
): Registry<CapabilityManifest> {
  return new Registry<CapabilityManifest>({
    kind: RegistryKind.CAPABILITY,
    schema: capabilityManifestSchema,
    businessRules: [capabilityNamespaceRule],
    events,
  });
}
