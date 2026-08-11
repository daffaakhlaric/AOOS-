import { describe, expect, it } from "vitest";

import { SupabaseStorageClient } from "../../../src/infrastructure/supabase/SupabaseStorageClient.js";
import { unwrap, unwrapErr } from "../../helpers/result.js";
import { createFakeSupabaseStorageClient } from "../../helpers/storage.js";

describe("SupabaseStorageClient", () => {
  it("upload() stores the file and resolves the public URL", async () => {
    const fake = createFakeSupabaseStorageClient();
    const client = new SupabaseStorageClient(fake, "mobix-assets");

    const result = unwrap(
      await client.upload({
        path: "brand/logo.png",
        fileBody: Buffer.from("fake-bytes"),
        contentType: "image/png",
      }),
    );
    expect(result.path).toBe("brand/logo.png");
    expect(result.publicUrl).toContain("mobix-assets/brand/logo.png");
    expect(fake.uploadSpy).toHaveBeenCalledWith(
      "brand/logo.png",
      Buffer.from("fake-bytes"),
      expect.objectContaining({ contentType: "image/png", upsert: false }),
    );
  });

  it("upload() surfaces a Storage error", async () => {
    const fake = createFakeSupabaseStorageClient();
    fake.forceErrorOnce("bucket not found");
    const client = new SupabaseStorageClient(fake, "mobix-assets");

    const error = unwrapErr(
      await client.upload({
        path: "brand/logo.png",
        fileBody: Buffer.from("fake-bytes"),
        contentType: "image/png",
      }),
    );
    expect(error.message).toContain("SupabaseStorageClient.upload failed");
  });
});
