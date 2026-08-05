import { z } from "zod";

import { baseManifestSchema } from "../../contracts/base-manifest.js";
import { RegistryKind } from "../../contracts/registry-kind.js";
import type { RegistryEventEmitter } from "../../events/registry-event-emitter.js";
import { Registry } from "../registry.js";

export const toolManifestSchema = baseManifestSchema.extend({
  provider: z.string().min(1),
  permission_scope: z.array(z.string()).optional(),
  side_effect_class: z.enum(["read_only", "reversible_write", "irreversible_write"]),
});

export type ToolManifest = z.infer<typeof toolManifestSchema>;

export function createToolRegistry(events?: RegistryEventEmitter): Registry<ToolManifest> {
  return new Registry<ToolManifest>({
    kind: RegistryKind.TOOL,
    schema: toolManifestSchema,
    events,
  });
}
