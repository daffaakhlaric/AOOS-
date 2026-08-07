import type { EmbeddingModelName } from "../domain/embedding-model-name.js";
import type { EmbeddingModel } from "../domain/embedding-model.js";

/** "IEmbeddingModelProvider" — interface ONLY. A caller-supplied source of truth for Model metadata (e.g. live catalog refresh from a vendor). */
export interface IEmbeddingModelProvider {
  describeModel(name: EmbeddingModelName): Promise<EmbeddingModel | undefined>;
}
