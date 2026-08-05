import type { KnowledgeClassification } from "../domain/knowledge-classification.js";
import type { KnowledgeDocument } from "../domain/knowledge-document.js";
import type { KnowledgeScope } from "../domain/knowledge-scope.js";
import type { KnowledgeTemplateCategory } from "../domain/knowledge-template-category.js";
import type { KnowledgeTemplate } from "../domain/knowledge-template.js";
import { TemplateNotFoundException } from "../errors/template-not-found-exception.js";
import { DocumentFactory } from "../factory/document-factory.js";
import { KnowledgeRegistryBucket } from "../registry/knowledge-registry-bucket.js";
import type { KnowledgeRegistry } from "../registry/knowledge-registry.js";

export interface InstantiateTemplateInput {
  readonly namespace: string;
  readonly scope: KnowledgeScope;
  readonly classification: KnowledgeClassification;
  readonly ownerId: string;
  readonly tags?: readonly string[];
  readonly labels?: readonly string[];
}

/** "KNOWLEDGE TEMPLATES" (docs/PROMPT-005.7A-KNOWLEDGE-ENGINE.md) — Templates live in `KnowledgeRegistry`'s `TEMPLATE` bucket; `instantiate()` builds a fresh `KnowledgeDocument` from one via `DocumentFactory`. */
export class KnowledgeTemplateEngine {
  constructor(
    private readonly registry: KnowledgeRegistry,
    private readonly documentFactory: DocumentFactory = new DocumentFactory(),
  ) {}

  register(template: KnowledgeTemplate): KnowledgeTemplate {
    return this.registry.register(KnowledgeRegistryBucket.TEMPLATE, template);
  }

  get(id: string): KnowledgeTemplate | undefined {
    return this.registry.get<KnowledgeTemplate>(KnowledgeRegistryBucket.TEMPLATE, id);
  }

  require(id: string): KnowledgeTemplate {
    const template = this.get(id);
    if (!template) {
      throw new TemplateNotFoundException(`No KnowledgeTemplate is registered with id "${id}"`);
    }
    return template;
  }

  list(): readonly KnowledgeTemplate[] {
    return this.registry.list<KnowledgeTemplate>(KnowledgeRegistryBucket.TEMPLATE);
  }

  listByCategory(category: KnowledgeTemplateCategory): readonly KnowledgeTemplate[] {
    return this.list().filter((template) => template.category === category);
  }

  instantiate(templateId: string, input: InstantiateTemplateInput): KnowledgeDocument {
    const template = this.require(templateId);
    return this.documentFactory.create({
      namespace: input.namespace,
      assetType: template.assetType,
      scope: input.scope,
      classification: input.classification,
      ownerId: input.ownerId,
      metadata: template.defaultMetadata,
      content: template.contentTemplate ? { template: template.contentTemplate } : undefined,
      tags: input.tags,
      labels: input.labels,
      templateId: template.id,
    });
  }
}
