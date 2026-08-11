import { Module } from "@nestjs/common";

import { ApiKeyGuard } from "./guards/api-key.guard.js";
import { MetaAdsController } from "./meta-ads.controller.js";
import { MetaAdsService } from "./meta-ads.service.js";

@Module({
  controllers: [MetaAdsController],
  providers: [MetaAdsService, ApiKeyGuard],
})
export class MetaAdsModule {}
