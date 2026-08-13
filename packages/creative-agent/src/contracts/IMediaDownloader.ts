import type { Result } from "@aos/common";
import type { KieApiError, MediaUrl } from "@aos/creative-connector";

/** Port (Hexagonal Architecture) for downloading a completed generation's media into a `Buffer`. The real implementation is `@aos/creative-connector`'s own `DownloadMedia` use case; an interface is used here for the same testability reason `IPhotoSource` documents. */
export interface IMediaDownloader {
  execute(url: MediaUrl | string): Promise<Result<Buffer, KieApiError>>;
}
