import type { Result } from "@aos/common";
import type {
  GeneratedVideo,
  GenerateLongVideoError,
  GenerateLongVideoInput,
} from "@aos/creative-connector";

/** Port (Hexagonal Architecture) for long-form video generation. The real implementation is `@aos/creative-connector`'s own `GenerateLongVideo` use case (already handles both a single 8s clip and multi-extend flows internally); an interface is used here for the same testability reason `IPhotoSource` documents. */
export interface IVideoGenerator {
  execute(input: GenerateLongVideoInput): Promise<Result<GeneratedVideo, GenerateLongVideoError>>;
}
