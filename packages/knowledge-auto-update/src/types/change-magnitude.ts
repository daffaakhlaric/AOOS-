/** Classification of the nature/magnitude of a detected change (`KnowledgeChangeAnalyzer`). */
export enum ChangeMagnitude {
  None = "none",
  MetadataOnly = "metadata_only",
  Content = "content",
  Structural = "structural",
}
