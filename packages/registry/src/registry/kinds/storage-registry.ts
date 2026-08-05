import { z } from "zod";

import { baseManifestSchema } from "../../contracts/base-manifest.js";
import { RegistryKind } from "../../contracts/registry-kind.js";
import type { RegistryEventEmitter } from "../../events/registry-event-emitter.js";
import { Registry } from "../registry.js";

export const storageManifestSchema = baseManifestSchema.extend({
  provider: z.enum(["r2", "s3", "minio"]),
  bucket_ref: z.string().min(1),
});

export type StorageManifest = z.infer<typeof storageManifestSchema>;

export function createStorageRegistry(events?: RegistryEventEmitter): Registry<StorageManifest> {
  return new Registry<StorageManifest>({
    kind: RegistryKind.STORAGE,
    schema: storageManifestSchema,
    events,
  });
}
