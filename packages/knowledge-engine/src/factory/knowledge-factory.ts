import { CollectionFactory } from "./collection-factory.js";
import { DocumentFactory } from "./document-factory.js";
import { MetadataFactory } from "./metadata-factory.js";
import { PolicyFactory } from "./policy-factory.js";
import { RelationshipFactory } from "./relationship-factory.js";
import { TemplateFactory } from "./template-factory.js";
import { VersionFactory } from "./version-factory.js";

/** "FACTORY: KnowledgeFactory, DocumentFactory, CollectionFactory, TemplateFactory, VersionFactory, MetadataFactory, RelationshipFactory, PolicyFactory." (docs/PROMPT-005.7A-KNOWLEDGE-ENGINE.md) — composes all 7 sub-factories behind one façade. */
export class KnowledgeFactory {
  readonly document = new DocumentFactory();
  readonly collection = new CollectionFactory();
  readonly template = new TemplateFactory();
  readonly version = new VersionFactory();
  readonly metadata = new MetadataFactory();
  readonly relationship = new RelationshipFactory();
  readonly policy = new PolicyFactory();
}
