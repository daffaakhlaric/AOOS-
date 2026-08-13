import type { Result } from "@aos/common";
import type { GenerateImageSetInput, GenerateImageSetResult } from "@aos/creative-connector";

/** Port (Hexagonal Architecture) for parallel N-image generation. The real implementation is `@aos/creative-connector`'s own `GenerateImageSet` use case (partial-failure-tolerant by design — its `Result` error type is `never`); an interface is used here for the same testability reason `IPhotoSource` documents. */
export interface IImageSetGenerator {
  execute(input: GenerateImageSetInput): Promise<Result<GenerateImageSetResult, never>>;
}
