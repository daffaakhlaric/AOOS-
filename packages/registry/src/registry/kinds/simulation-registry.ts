import { z } from "zod";

import { baseManifestSchema } from "../../contracts/base-manifest.js";
import { RegistryKind } from "../../contracts/registry-kind.js";
import type { RegistryEventEmitter } from "../../events/registry-event-emitter.js";
import { Registry } from "../registry.js";

export const simulationManifestSchema = baseManifestSchema.extend({
  scenario_refs: z.array(z.string()).optional(),
  seed_strategy: z.enum(["fixed", "random"]).default("fixed"),
});

export type SimulationManifest = z.infer<typeof simulationManifestSchema>;

export function createSimulationRegistry(
  events?: RegistryEventEmitter,
): Registry<SimulationManifest> {
  return new Registry<SimulationManifest>({
    kind: RegistryKind.SIMULATION,
    schema: simulationManifestSchema,
    events,
  });
}
