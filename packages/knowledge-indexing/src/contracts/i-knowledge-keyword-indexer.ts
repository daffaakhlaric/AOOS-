/** Interface only — no implementation in this package. A future full-text engine (e.g. an inverted-index or search-engine adapter) would tokenize and index `content` under this contract. */
export interface IKnowledgeKeywordIndexer {
  index(assetId: string, content: string): Promise<void>;
  remove(assetId: string): Promise<void>;
}
