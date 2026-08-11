import { AssetError, type UploadAsset, type UploadAssetInput } from "@aos/asset-library";
import { err, ok, type Result } from "@aos/common";
import { vi } from "vitest";

/**
 * A minimal spy-based `@aos/asset-library` `UploadAsset` test double — records every
 * `execute()` call and returns a scripted `Result`, mirroring `tests/helpers/publisher.ts`'s
 * `FakePublisher`. Zero real Supabase network calls: `@aos/asset-library`'s `UploadAsset` is
 * mocked wholesale here, never constructed via its real factory/Supabase clients.
 *
 * The successful branch only populates the two members `DownloadAndStorePhotos` actually reads
 * off the real `Asset` return value (`id.toString()`, `publicUrl.toString()`) — a structural
 * stand-in, not a real `Asset` entity, since building one would require the full
 * `AssetId`/`PublicUrl`/`StoragePath`/... value-object graph this package has no reason to depend
 * on directly.
 */
export interface FakeAssetResult {
  readonly id: { toString(): string };
  readonly publicUrl: { toString(): string };
}

export interface FakeUploadAsset {
  readonly calls: UploadAssetInput[];
  readonly execute: (input: UploadAssetInput) => Promise<Result<FakeAssetResult, AssetError>>;
}

let counter = 0;

export function createFakeUploadAsset(
  scripted?: (input: UploadAssetInput) => Result<FakeAssetResult, string>,
): FakeUploadAsset {
  const calls: UploadAssetInput[] = [];

  const execute = vi.fn(
    async (input: UploadAssetInput): Promise<Result<FakeAssetResult, AssetError>> => {
      calls.push(input);
      counter += 1;
      const outcome: Result<FakeAssetResult, string> = scripted
        ? scripted(input)
        : ok({
            id: { toString: () => `asset-${counter}` },
            publicUrl: { toString: () => `https://cdn.test/asset-${counter}.jpg` },
          });

      if (!outcome.ok) {
        return err(new AssetError(outcome.error));
      }
      return ok(outcome.value);
    },
  );

  return { calls, execute };
}

/** Casts a `FakeUploadAsset` to the real `UploadAsset` type at the call boundary — the same `as unknown as` pattern `tests/unit/application/MobixScraperService.spec.ts` already uses for its `ScrapeInventory`/`ScrapePromos` doubles. */
export function asUploadAsset(fake: FakeUploadAsset): UploadAsset {
  return fake as unknown as UploadAsset;
}
