import { err, ok, type Result } from "@aos/common";

import { KieApiError } from "../../domain/errors/KieApiError.js";
import type { MediaUrl } from "../../domain/value-objects/MediaUrl.js";

const DEFAULT_TIMEOUT_MS = 30_000;

/**
 * Downloads a completed generation's result (`videoUrl`/`imageUrl`) into a `Buffer` — the caller
 * (a future orchestrator, W3H's "Kai") is responsible for handing that buffer to
 * `@aos/asset-library` to store; this package does not depend on `@aos/asset-library` itself. Kie
 * AI's generated-media links can expire (the spec's own test case: "404 → error (file expired
 * after 14 days)"), surfaced here as a `KieApiError`, never a silent empty buffer.
 */
export class DownloadMedia {
  private readonly fetchImpl: typeof fetch;
  private readonly timeoutMs: number;

  constructor(fetchImpl: typeof fetch = fetch, timeoutMs: number = DEFAULT_TIMEOUT_MS) {
    this.fetchImpl = fetchImpl;
    this.timeoutMs = timeoutMs;
  }

  async execute(url: MediaUrl | string): Promise<Result<Buffer, KieApiError>> {
    const urlStr = typeof url === "string" ? url : url.toString();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

    let response: Response;
    try {
      response = await this.fetchImpl(urlStr, { signal: controller.signal });
    } catch (error) {
      return err(
        new KieApiError(`DownloadMedia: network failure fetching ${urlStr}`, {
          cause: error instanceof Error ? error : undefined,
        }),
      );
    } finally {
      clearTimeout(timeout);
    }

    if (!response.ok) {
      return err(
        new KieApiError(`DownloadMedia: ${urlStr} responded with HTTP ${response.status}`, {
          httpStatus: response.status,
        }),
      );
    }

    let arrayBuffer: ArrayBuffer;
    try {
      arrayBuffer = await response.arrayBuffer();
    } catch (error) {
      return err(
        new KieApiError(`DownloadMedia: failed to read response body for ${urlStr}`, {
          cause: error instanceof Error ? error : undefined,
        }),
      );
    }

    return ok(Buffer.from(arrayBuffer));
  }
}
