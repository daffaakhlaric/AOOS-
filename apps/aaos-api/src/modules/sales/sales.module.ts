import { Module } from "@nestjs/common";

import { ApiKeyGuard } from "../meta-ads/guards/api-key.guard.js";

import { SalesController } from "./sales.controller.js";
import { SalesService } from "./sales.service.js";

@Module({
  controllers: [SalesController],
  providers: [SalesService, ApiKeyGuard],
})
export class SalesModule {}
