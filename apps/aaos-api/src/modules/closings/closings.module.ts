import { Module } from "@nestjs/common";

import { ApiKeyGuard } from "../meta-ads/guards/api-key.guard.js";

import { ClosingsController } from "./closings.controller.js";
import { ClosingsService } from "./closings.service.js";

@Module({
  controllers: [ClosingsController],
  providers: [ClosingsService, ApiKeyGuard],
})
export class ClosingsModule {}
