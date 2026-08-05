import { z } from "zod";

import { baseManifestSchema } from "../../contracts/base-manifest.js";
import { RegistryKind } from "../../contracts/registry-kind.js";
import type { RegistryEventEmitter } from "../../events/registry-event-emitter.js";
import { Registry } from "../registry.js";

export const schedulerManifestSchema = baseManifestSchema.extend({
  trigger_type: z.enum(["cron", "interval", "calendar"]),
  schedule_expression: z.string().min(1),
  timezone: z.string().default("UTC"),
});

export type SchedulerManifest = z.infer<typeof schedulerManifestSchema>;

export function createSchedulerRegistry(
  events?: RegistryEventEmitter,
): Registry<SchedulerManifest> {
  return new Registry<SchedulerManifest>({
    kind: RegistryKind.SCHEDULER,
    schema: schedulerManifestSchema,
    events,
  });
}
