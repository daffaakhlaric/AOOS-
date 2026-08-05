import { describe, expect, it } from "vitest";

import { CollectionFactory } from "../../src/factory/collection-factory.js";
import { DocumentFactory } from "../../src/factory/document-factory.js";
import { KnowledgeFactory } from "../../src/factory/knowledge-factory.js";
import { MetadataFactory } from "../../src/factory/metadata-factory.js";
import { PolicyFactory } from "../../src/factory/policy-factory.js";
import { RelationshipFactory } from "../../src/factory/relationship-factory.js";
import { TemplateFactory } from "../../src/factory/template-factory.js";
import { VersionFactory } from "../../src/factory/version-factory.js";

describe("Factory Test — KnowledgeFactory", () => {
  it("exposes all 7 sub-factories", () => {
    const factory = new KnowledgeFactory();
    expect(factory.document).toBeInstanceOf(DocumentFactory);
    expect(factory.collection).toBeInstanceOf(CollectionFactory);
    expect(factory.template).toBeInstanceOf(TemplateFactory);
    expect(factory.version).toBeInstanceOf(VersionFactory);
    expect(factory.metadata).toBeInstanceOf(MetadataFactory);
    expect(factory.relationship).toBeInstanceOf(RelationshipFactory);
    expect(factory.policy).toBeInstanceOf(PolicyFactory);
  });
});
