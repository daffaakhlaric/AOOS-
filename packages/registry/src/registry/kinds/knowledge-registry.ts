import { z } from "zod";

import { baseManifestSchema } from "../../contracts/base-manifest.js";
import { RegistryKind } from "../../contracts/registry-kind.js";
import type { RegistryEventEmitter } from "../../events/registry-event-emitter.js";
import { Registry } from "../registry.js";

export const knowledgeManifestSchema = baseManifestSchema.extend({
  source_type: z.enum(["document", "database", "api", "feed"]),
  max_staleness_sla: z.string().optional(),
});

export type KnowledgeManifest = z.infer<typeof knowledgeManifestSchema>;

export function createKnowledgeRegistry(
  events?: RegistryEventEmitter,
): Registry<KnowledgeManifest> {
  return new Registry<KnowledgeManifest>({
    kind: RegistryKind.KNOWLEDGE,
    schema: knowledgeManifestSchema,
    events,
  });
}
