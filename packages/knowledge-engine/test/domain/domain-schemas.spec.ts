import { describe, expect, it } from "vitest";

import { knowledgeAssetSchema } from "../../src/domain/knowledge-asset.js";
import { knowledgeAuditSchema } from "../../src/domain/knowledge-audit.js";
import { knowledgeChunkSchema } from "../../src/domain/knowledge-chunk.js";
import { KnowledgeClassification } from "../../src/domain/knowledge-classification.js";
import {
  knowledgeCollectionSchema,
  knowledgeFolderSchema,
  knowledgeLibrarySchema,
  knowledgeNamespaceSchema,
  knowledgeWorkspaceSchema,
} from "../../src/domain/knowledge-collection.js";
import { knowledgeDocumentSchema } from "../../src/domain/knowledge-document.js";
import { KnowledgeLifecycleState } from "../../src/domain/knowledge-lifecycle-state.js";
import { knowledgeManifestSchema } from "../../src/domain/knowledge-manifest.js";
import {
  EMPTY_KNOWLEDGE_STATISTICS,
  knowledgeMetadataSchema,
  knowledgeStatisticsSchema,
} from "../../src/domain/knowledge-metadata.js";
import {
  knowledgeConsumerSchema,
  knowledgeOwnerSchema,
  knowledgePublisherSchema,
} from "../../src/domain/knowledge-parties.js";
import { knowledgePermissionSchema } from "../../src/domain/knowledge-permission.js";
import { KnowledgePolicyType } from "../../src/domain/knowledge-policy-type.js";
import { knowledgePolicySchema } from "../../src/domain/knowledge-policy.js";
import { KnowledgeRelationshipType } from "../../src/domain/knowledge-relationship-type.js";
import { knowledgeRelationshipSchema } from "../../src/domain/knowledge-relationship.js";
import {
  knowledgeApprovalSchema,
  knowledgeReviewSchema,
} from "../../src/domain/knowledge-review.js";
import { knowledgeSchemaSchema } from "../../src/domain/knowledge-schema.js";
import { knowledgeSourceSchema } from "../../src/domain/knowledge-source.js";
import {
  knowledgeCategorySchema,
  knowledgeLabelSchema,
  knowledgeTagSchema,
} from "../../src/domain/knowledge-taxonomy.js";
import { KnowledgeTemplateCategory } from "../../src/domain/knowledge-template-category.js";
import { knowledgeTemplateSchema } from "../../src/domain/knowledge-template.js";
import {
  createKnowledgeVersion,
  formatKnowledgeVersion,
  knowledgeSnapshotSchema,
  knowledgeVersionSchema,
} from "../../src/domain/knowledge-version.js";
import { assetFixture } from "../helpers/asset-fixture.js";

const now = new Date().toISOString();

describe("Domain Test — schema sanity", () => {
  it("knowledgeAssetSchema accepts a fixture Asset", () => {
    expect(knowledgeAssetSchema.safeParse(assetFixture()).success).toBe(true);
  });

  it("knowledgeDocumentSchema accepts an Asset with optional chunks", () => {
    const asset = assetFixture();
    expect(knowledgeDocumentSchema.safeParse({ ...asset, chunks: [] }).success).toBe(true);
  });

  it("knowledgeChunkSchema accepts a minimal Chunk", () => {
    expect(
      knowledgeChunkSchema.safeParse({ id: "c-1", documentId: "d-1", sequence: 0, text: "hello" })
        .success,
    ).toBe(true);
  });

  it("knowledgeMetadataSchema rejects a missing classification", () => {
    expect(
      knowledgeMetadataSchema.safeParse({
        tags: [],
        keywords: [],
        createdAt: now,
        updatedAt: now,
        custom: {},
      }).success,
    ).toBe(false);
  });

  it("knowledgeStatisticsSchema accepts EMPTY_KNOWLEDGE_STATISTICS", () => {
    expect(knowledgeStatisticsSchema.safeParse(EMPTY_KNOWLEDGE_STATISTICS).success).toBe(true);
  });

  it("createKnowledgeVersion()/formatKnowledgeVersion() produce a matching label", () => {
    const version = createKnowledgeVersion({ major: 2, minor: 3, patch: 4 });
    expect(version.label).toBe(formatKnowledgeVersion(2, 3, 4));
    expect(knowledgeVersionSchema.safeParse(version).success).toBe(true);
  });

  it("knowledgeSnapshotSchema accepts a minimal Snapshot", () => {
    expect(
      knowledgeSnapshotSchema.safeParse({
        id: "s-1",
        assetId: "a-1",
        version: createKnowledgeVersion(),
        capturedAt: now,
        data: {},
      }).success,
    ).toBe(true);
  });

  it("knowledgeRelationshipSchema accepts a minimal Relationship", () => {
    expect(
      knowledgeRelationshipSchema.safeParse({
        id: "r-1",
        fromAssetId: "a-1",
        toAssetId: "a-2",
        type: KnowledgeRelationshipType.RELATED,
        createdAt: now,
      }).success,
    ).toBe(true);
  });

  it("knowledgePolicySchema accepts a minimal Policy", () => {
    expect(
      knowledgePolicySchema.safeParse({
        id: "p-1",
        name: "Retention",
        type: KnowledgePolicyType.RETENTION,
        scope: { tenantId: "t1" },
        rule: {},
        enabled: true,
        createdAt: now,
      }).success,
    ).toBe(true);
  });

  it("knowledgePermissionSchema accepts a minimal Permission", () => {
    expect(
      knowledgePermissionSchema.safeParse({
        id: "perm-1",
        subjectType: "user",
        subjectId: "u-1",
        action: "read",
        effect: "allow",
        scope: { tenantId: "t1" },
        createdAt: now,
      }).success,
    ).toBe(true);
  });

  it("knowledgeCategorySchema/knowledgeTagSchema/knowledgeLabelSchema accept minimal entries", () => {
    expect(knowledgeCategorySchema.safeParse({ id: "cat-1", name: "Sales" }).success).toBe(true);
    expect(knowledgeTagSchema.safeParse({ id: "tag-1", name: "urgent" }).success).toBe(true);
    expect(knowledgeLabelSchema.safeParse({ id: "lbl-1", key: "env", value: "prod" }).success).toBe(
      true,
    );
  });

  it("knowledgeOwnerSchema/knowledgePublisherSchema/knowledgeConsumerSchema accept minimal entries", () => {
    expect(knowledgeOwnerSchema.safeParse({ userId: "u-1", assignedAt: now }).success).toBe(true);
    expect(knowledgePublisherSchema.safeParse({ userId: "u-1", publishedAt: now }).success).toBe(
      true,
    );
    expect(knowledgeConsumerSchema.safeParse({ consumerId: "c-1", consumedAt: now }).success).toBe(
      true,
    );
  });

  it("knowledgeApprovalSchema/knowledgeReviewSchema accept minimal entries", () => {
    expect(
      knowledgeApprovalSchema.safeParse({
        id: "appr-1",
        assetId: "a-1",
        approverId: "u-1",
        status: "pending",
      }).success,
    ).toBe(true);
    expect(
      knowledgeReviewSchema.safeParse({
        id: "rev-1",
        assetId: "a-1",
        reviewerId: "u-1",
        status: "pending",
      }).success,
    ).toBe(true);
  });

  it("knowledgeAuditSchema accepts a minimal entry", () => {
    expect(
      knowledgeAuditSchema.safeParse({
        id: "audit-1",
        assetId: "a-1",
        action: "created",
        occurredAt: now,
      }).success,
    ).toBe(true);
  });

  it("knowledgeSchemaSchema accepts a minimal descriptor", () => {
    expect(
      knowledgeSchemaSchema.safeParse({
        id: "schema-1",
        name: "Document Schema",
        assetType: "document",
        version: "1.0.0",
        fields: { title: "string" },
        requiredFields: ["title"],
      }).success,
    ).toBe(true);
  });

  it("knowledgeSourceSchema accepts a minimal Source", () => {
    expect(
      knowledgeSourceSchema.safeParse({ id: "src-1", name: "CRM Import", type: "import" }).success,
    ).toBe(true);
  });

  it("knowledgeTemplateSchema accepts a minimal Template", () => {
    expect(
      knowledgeTemplateSchema.safeParse({
        id: "tmpl-1",
        name: "FAQ Template",
        category: KnowledgeTemplateCategory.FAQ,
        assetType: "faq",
        version: "1.0.0",
        createdAt: now,
      }).success,
    ).toBe(true);
  });

  it("knowledgeWorkspaceSchema/knowledgeLibrarySchema/knowledgeCollectionSchema/knowledgeFolderSchema accept minimal entries", () => {
    expect(
      knowledgeWorkspaceSchema.safeParse({
        id: "ws-1",
        name: "Sales",
        tenantId: "t1",
        createdAt: now,
      }).success,
    ).toBe(true);
    expect(
      knowledgeLibrarySchema.safeParse({
        id: "lib-1",
        name: "Docs",
        scope: { tenantId: "t1" },
        createdAt: now,
      }).success,
    ).toBe(true);
    expect(
      knowledgeCollectionSchema.safeParse({
        id: "col-1",
        name: "Playbooks",
        scope: { tenantId: "t1" },
        assetIds: [],
        createdAt: now,
      }).success,
    ).toBe(true);
    expect(
      knowledgeFolderSchema.safeParse({
        id: "fld-1",
        name: "2026",
        collectionId: "col-1",
        scope: { tenantId: "t1" },
      }).success,
    ).toBe(true);
  });

  it("knowledgeNamespaceSchema accepts a parsed namespace shape", () => {
    expect(
      knowledgeNamespaceSchema.safeParse({
        uri: "knowledge://t1/w1/l1/d1",
        tenant: "t1",
        workspace: "w1",
        library: "l1",
        document: "d1",
      }).success,
    ).toBe(true);
  });

  it("knowledgeManifestSchema accepts a minimal Manifest", () => {
    expect(
      knowledgeManifestSchema.safeParse({
        id: "a-1",
        namespace: "knowledge://t1/w1/l1/d1",
        assetType: "document",
        versionLabel: "1.0.0",
        classification: KnowledgeClassification.INTERNAL,
        scope: { tenantId: "t1" },
      }).success,
    ).toBe(true);
  });

  it("asset fixture's lifecycleState defaults to DRAFT", () => {
    expect(assetFixture().lifecycleState).toBe(KnowledgeLifecycleState.DRAFT);
  });
});
