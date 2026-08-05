import type { KnowledgeAssetType } from "../domain/knowledge-asset-type.js";
import type { KnowledgeTemplateCategory } from "../domain/knowledge-template-category.js";
import type { KnowledgeTemplate } from "../domain/knowledge-template.js";
import { generateId } from "../utils/id.js";

export interface CreateTemplateInput {
  readonly name: string;
  readonly category: KnowledgeTemplateCategory;
  readonly assetType: KnowledgeAssetType;
  readonly version?: string;
  readonly defaultMetadata?: Readonly<Record<string, unknown>>;
  readonly contentTemplate?: string;
}

/** Builds a fresh `KnowledgeTemplate` — `version` defaults to `"1.0.0"`. */
export class TemplateFactory {
  create(input: CreateTemplateInput): KnowledgeTemplate {
    return {
      id: generateId(),
      name: input.name,
      category: input.category,
      assetType: input.assetType,
      version: input.version ?? "1.0.0",
      defaultMetadata: input.defaultMetadata,
      contentTemplate: input.contentTemplate,
      createdAt: new Date().toISOString(),
    };
  }
}
