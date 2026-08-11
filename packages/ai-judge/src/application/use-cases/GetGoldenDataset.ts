import type { GoldenConversation } from "../../domain/entities/GoldenConversation.js";
import type { GoldenDatasetService } from "../services/GoldenDatasetService.js";

/** Returns every saved golden conversation (spec "application/use-cases/GetGoldenDataset.ts"). */
export class GetGoldenDataset {
  constructor(private readonly goldenDatasetService: GoldenDatasetService) {}

  execute(): ReadonlyArray<GoldenConversation> {
    return this.goldenDatasetService.getAll();
  }
}
