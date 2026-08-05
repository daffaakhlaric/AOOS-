import { z } from "zod";

import { baseManifestSchema } from "../../contracts/base-manifest.js";
import { RegistryKind } from "../../contracts/registry-kind.js";
import type { RegistryEventEmitter } from "../../events/registry-event-emitter.js";
import { Registry } from "../registry.js";

export const permissionManifestSchema = baseManifestSchema.extend({
  actions: z.array(z.enum(["create", "read", "update", "approve", "deny"])),
  resources: z.array(z.string()).optional(),
});

export type PermissionManifest = z.infer<typeof permissionManifestSchema>;

export function createPermissionRegistry(
  events?: RegistryEventEmitter,
): Registry<PermissionManifest> {
  return new Registry<PermissionManifest>({
    kind: RegistryKind.PERMISSION,
    schema: permissionManifestSchema,
    events,
  });
}
