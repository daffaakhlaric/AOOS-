import { err, ok, type Result } from "@aos/common";

import type {
  IAssetStorage,
  UploadedFile,
  UploadFileInput,
} from "../../contracts/IAssetStorage.js";
import { StorageError } from "../../domain/errors/StorageError.js";

import type { SupabaseStorageClientLike } from "./SupabaseStorageTypes.js";

/** Supabase Storage implementation of `IAssetStorage` — uploads bytes to the configured bucket and resolves the CDN public URL. Mirrors `@aos/lead-store`'s Postgrest repositories' error-wrapping discipline, adapted to the Storage API's `upload`/`getPublicUrl` shape. */
export class SupabaseStorageClient implements IAssetStorage {
  constructor(
    private readonly client: SupabaseStorageClientLike,
    private readonly bucketName: string,
  ) {}

  async upload(input: UploadFileInput): Promise<Result<UploadedFile, StorageError>> {
    const bucket = this.client.from(this.bucketName);
    const { data, error } = await bucket.upload(input.path, input.fileBody, {
      contentType: input.contentType,
      upsert: false,
    });
    if (error !== null) {
      return err(new StorageError(`SupabaseStorageClient.upload failed: ${error.message}`));
    }
    const { publicUrl } = bucket.getPublicUrl(data.path).data;
    return ok({ path: data.path, publicUrl });
  }
}
