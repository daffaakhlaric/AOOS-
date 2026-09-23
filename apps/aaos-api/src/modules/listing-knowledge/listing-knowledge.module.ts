import { Module } from "@nestjs/common";

import { ApiKeyGuard } from "../meta-ads/guards/api-key.guard.js";

import { KnowledgeModelGateway, OpenAiKnowledgeGateway } from "./knowledge-model.gateway.js";
import { ListingKnowledgeController } from "./listing-knowledge.controller.js";
import { ListingKnowledgeService } from "./listing-knowledge.service.js";
@Module({
  controllers: [ListingKnowledgeController],
  providers: [
    ApiKeyGuard,
    ListingKnowledgeService,
    { provide: KnowledgeModelGateway, useClass: OpenAiKnowledgeGateway },
  ],
  exports: [ListingKnowledgeService],
})
export class ListingKnowledgeModule {}
