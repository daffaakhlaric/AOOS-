import type { EmbeddingRequest } from "../domain/embedding-request.js";

/** "IEmbeddingCostProvider" — interface ONLY. A caller-supplied cost estimator/reporter for a given Request's Provider/Model combination. */
export interface IEmbeddingCostProvider {
  estimateCost(
    request: EmbeddingRequest,
  ): Promise<{ readonly amount: number; readonly currency: string }>;
}
