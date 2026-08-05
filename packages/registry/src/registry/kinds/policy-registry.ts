import { z } from "zod";

import { baseManifestSchema } from "../../contracts/base-manifest.js";
import { RegistryKind } from "../../contracts/registry-kind.js";
import type { RegistryEventEmitter } from "../../events/registry-event-emitter.js";
import { Registry } from "../registry.js";

export const policyManifestSchema = baseManifestSchema.extend({
  rule_type: z.enum(["guardrail", "budget", "compliance"]),
  enforcement_level: z.enum(["advisory", "blocking"]).default("blocking"),
});

export type PolicyManifest = z.infer<typeof policyManifestSchema>;

export function createPolicyRegistry(events?: RegistryEventEmitter): Registry<PolicyManifest> {
  return new Registry<PolicyManifest>({
    kind: RegistryKind.POLICY,
    schema: policyManifestSchema,
    events,
  });
}
