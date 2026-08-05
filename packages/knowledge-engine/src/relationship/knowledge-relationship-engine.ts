import { KNOWLEDGE_RELATIONSHIP_INVERSE } from "../domain/knowledge-relationship-type.js";
import type { KnowledgeRelationship } from "../domain/knowledge-relationship.js";
import { InvalidRelationshipException } from "../errors/invalid-relationship-exception.js";
import { KnowledgeRegistryBucket } from "../registry/knowledge-registry-bucket.js";
import type { KnowledgeRegistry } from "../registry/knowledge-registry.js";
import { generateId } from "../utils/id.js";

/**
 * "KNOWLEDGE RELATIONSHIPS" (docs/PROMPT-005.7A-KNOWLEDGE-ENGINE.md) — registers one
 * directed edge plus its structural inverse (`KNOWLEDGE_RELATIONSHIP_INVERSE`) into
 * `KnowledgeRegistry`'s `RELATIONSHIP` bucket, and maintains an in-memory outgoing/incoming
 * adjacency index for `neighbors()` traversal — a future `IKnowledgeGraph` implementation
 * would build richer graph analytics on top of this, not replace it.
 */
export class KnowledgeRelationshipEngine {
  private readonly outgoingByAsset = new Map<string, KnowledgeRelationship[]>();
  private readonly incomingByAsset = new Map<string, KnowledgeRelationship[]>();

  constructor(private readonly registry: KnowledgeRegistry) {}

  add(relationship: KnowledgeRelationship): KnowledgeRelationship {
    if (relationship.fromAssetId === relationship.toAssetId) {
      throw new InvalidRelationshipException(
        `Relationship "${relationship.id}" cannot reference the same Asset on both ends`,
      );
    }
    this.registry.register(KnowledgeRegistryBucket.RELATIONSHIP, relationship);
    this.index(relationship);

    const inverse: KnowledgeRelationship = {
      id: generateId(),
      fromAssetId: relationship.toAssetId,
      toAssetId: relationship.fromAssetId,
      type: KNOWLEDGE_RELATIONSHIP_INVERSE[relationship.type],
      createdAt: relationship.createdAt,
      metadata: relationship.metadata,
    };
    this.registry.register(KnowledgeRegistryBucket.RELATIONSHIP, inverse);
    this.index(inverse);

    return relationship;
  }

  remove(id: string): boolean {
    const relationship = this.registry.get<KnowledgeRelationship>(
      KnowledgeRegistryBucket.RELATIONSHIP,
      id,
    );
    if (!relationship) {
      return false;
    }
    this.registry.remove(KnowledgeRegistryBucket.RELATIONSHIP, id);
    this.unindex(relationship);
    return true;
  }

  list(): readonly KnowledgeRelationship[] {
    return this.registry.list<KnowledgeRelationship>(KnowledgeRegistryBucket.RELATIONSHIP);
  }

  outgoing(assetId: string): readonly KnowledgeRelationship[] {
    return this.outgoingByAsset.get(assetId) ?? [];
  }

  incoming(assetId: string): readonly KnowledgeRelationship[] {
    return this.incomingByAsset.get(assetId) ?? [];
  }

  neighbors(assetId: string): readonly KnowledgeRelationship[] {
    return [...this.outgoing(assetId), ...this.incoming(assetId)];
  }

  private index(relationship: KnowledgeRelationship): void {
    const outgoing = this.outgoingByAsset.get(relationship.fromAssetId) ?? [];
    outgoing.push(relationship);
    this.outgoingByAsset.set(relationship.fromAssetId, outgoing);

    const incoming = this.incomingByAsset.get(relationship.toAssetId) ?? [];
    incoming.push(relationship);
    this.incomingByAsset.set(relationship.toAssetId, incoming);
  }

  private unindex(relationship: KnowledgeRelationship): void {
    const outgoing = this.outgoingByAsset.get(relationship.fromAssetId);
    if (outgoing) {
      this.outgoingByAsset.set(
        relationship.fromAssetId,
        outgoing.filter((entry) => entry.id !== relationship.id),
      );
    }
    const incoming = this.incomingByAsset.get(relationship.toAssetId);
    if (incoming) {
      this.incomingByAsset.set(
        relationship.toAssetId,
        incoming.filter((entry) => entry.id !== relationship.id),
      );
    }
  }
}
