/** Interface only — no implementation in this package. A future faceted-search backend would index structured Metadata fields under this contract. */
export interface IKnowledgeMetadataIndexer {
  index(assetId: string, metadata: Readonly<Record<string, unknown>>): Promise<void>;
  remove(assetId: string): Promise<void>;
}
