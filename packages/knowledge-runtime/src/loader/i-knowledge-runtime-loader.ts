import type { KnowledgeAsset } from "@aos/knowledge-engine";

export interface IKnowledgeRuntimeLoader {
  loadById(id: string): KnowledgeAsset;
  loadByNamespace(uri: string): KnowledgeAsset;
  tryLoadById(id: string): KnowledgeAsset | undefined;
  tryLoadByNamespace(uri: string): KnowledgeAsset | undefined;
}
