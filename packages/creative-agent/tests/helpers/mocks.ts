import type { Asset, AssetCollection } from "@aos/asset-library";
import {
  AssetCollection as AssetCollectionImpl,
  AssetStatus,
  AssetType,
  MimeType,
} from "@aos/asset-library";
import { err, ok, type Result } from "@aos/common";
import {
  AspectRatio,
  ImageModel,
  KieApiError,
  VideoModel,
  type GeneratedImage,
  type GeneratedVideo,
  type UploadedFile,
} from "@aos/creative-connector";
import type { IPublisher } from "@aos/event-bus";
import { Branch } from "@aos/meta-ads-connector";
import { vi } from "vitest";

import { unwrap } from "./result.js";

/**
 * `@aos/asset-library`'s public `index.ts` deliberately exports `Asset`/`AssetId`/`PublicUrl`/
 * `StoragePath` as TYPE-ONLY (their classes have private constructors, and no public factory is
 * exposed outside the package) — external callers only ever RECEIVE `Asset` instances back from
 * use cases like `GetAssetsByUnit`/`SaveAiCreative`, never construct them directly. For these
 * tests (which mock those use cases entirely, per the mission brief's "asset-library fully
 * mocked" requirement) a structurally-shaped fake, cast to `Asset`, stands in — it only needs the
 * getters `KaiAgentService`/`CreativeOrchestratorService` actually read (`.type`, `.publicUrl`,
 * `.fileName`, `.mimeType`, `.unitId`, `.createdAt`).
 */
export function buildAsset(
  overrides: {
    readonly type?: AssetType;
    readonly publicUrl?: string;
    readonly fileName?: string;
    readonly unitId?: string;
    readonly createdAt?: Date;
    readonly mimeType?: string;
  } = {},
): Asset {
  const fake = {
    id: { toString: () => "asset-1" },
    tenantId: "dss-motor",
    type: overrides.type ?? AssetType.UNIT_PHOTO,
    status: AssetStatus.ACTIVE,
    storagePath: { toString: () => "units/xpander/photo-1.jpg" },
    publicUrl: { toString: () => overrides.publicUrl ?? "https://cdn.supabase.test/xpander-1.jpg" },
    fileName: overrides.fileName ?? "xpander-1.jpg",
    mimeType: unwrap(MimeType.create(overrides.mimeType ?? "image/jpeg")),
    fileSize: { bytes: 102_400, toString: () => "102400" },
    tags: [],
    unitId: overrides.unitId ?? "Xpander Cross 2019",
    branch: Branch.BINTARO,
    createdAt: overrides.createdAt ?? new Date("2026-07-01T00:00:00.000Z"),
    updatedAt: overrides.createdAt ?? new Date("2026-07-01T00:00:00.000Z"),
  };
  return fake as unknown as Asset;
}

export function buildAssetCollection(assets: readonly Asset[]): AssetCollection {
  return AssetCollectionImpl.of(assets);
}

/**
 * `@aos/creative-connector`'s public `index.ts` also exports `UploadedFile`/`GeneratedVideo`/
 * `GeneratedImage`/`TaskId`/`MediaUrl`/`FileUrl` TYPE-ONLY (same reasoning as `Asset` above — see
 * that docstring). These fakes only need the getters `CreativeOrchestratorService` actually reads
 * (`.fileUrl`, `.videoUrl`, `.imageUrl`).
 */
export function buildUploadedFile(
  fileUrl = "https://cdn.kie.ai/uploads/source-1.jpg",
): UploadedFile {
  const fake = {
    fileId: { toString: () => "file-1" },
    fileUrl: { toString: () => fileUrl },
    fileName: "source-1.jpg",
    uploadedAt: new Date("2026-08-01T00:00:00.000Z"),
    isExpired: () => false,
  };
  return fake as unknown as UploadedFile;
}

export function buildGeneratedVideo(
  videoUrl = "https://cdn.kie.ai/videos/out-1.mp4",
): GeneratedVideo {
  const fake = {
    taskId: { toString: () => "task-video-1" },
    videoUrl: { toString: () => videoUrl },
    model: VideoModel.VEO3_FAST,
    aspectRatio: AspectRatio.WIDESCREEN,
    totalDurationSeconds: 8,
  };
  return fake as unknown as GeneratedVideo;
}

let imageTaskCounter = 0;

export function buildGeneratedImage(imageUrl: string): GeneratedImage {
  imageTaskCounter += 1;
  const fake = {
    taskId: { toString: () => `task-image-${String(imageTaskCounter)}` },
    imageUrl: { toString: () => imageUrl },
    images: [{ toString: () => imageUrl }],
    model: ImageModel.NANO_BANANA_PRO,
    aspectRatio: AspectRatio.SQUARE,
  };
  return fake as unknown as GeneratedImage;
}

export function apiError(message: string): KieApiError {
  return new KieApiError(message);
}

export function okResult<T>(value: T): Result<T, never> {
  return ok(value);
}

export function errResult<E>(error: E): Result<never, E> {
  return err(error);
}

/** Records every published event without touching a real broker — mirrors `@aos/ai-judge`'s `ObservablePublisher`. */
export class RecordingPublisher implements IPublisher {
  readonly published: Array<{ type: string; payload: unknown }> = [];

  publish = vi.fn(async (input: { type: string; payload: unknown }) => {
    this.published.push({ type: input.type, payload: input.payload });
    return { ...input, id: "evt-1", occurredAt: new Date() } as never;
  });

  publishAsync = vi.fn(async (input: { type: string; payload: unknown }) => {
    this.published.push({ type: input.type, payload: input.payload });
    return { ...input, id: "evt-1", occurredAt: new Date() } as never;
  });

  publishBatch = vi.fn(async () => []) as never;
}
