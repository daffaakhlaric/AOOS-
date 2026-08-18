import { type Result } from "@aos/common";

import type { AssetStats, IAssetRepository } from "../../contracts/IAssetRepository.js";
import type { AssetError } from "../../domain/errors/AssetError.js";

export interface GetAssetStatsInput {
  readonly tenantId: string;
}

/** Tenant-scoped aggregate counts for the Asset Library page's KPI strip (AAOS-SCRAPER-ASSET-LIBRARY). */
export class GetAssetStats {
  constructor(private readonly repository: IAssetRepository) {}

  async execute(input: GetAssetStatsInput): Promise<Result<AssetStats, AssetError>> {
    return this.repository.getStats(input.tenantId);
  }
}
