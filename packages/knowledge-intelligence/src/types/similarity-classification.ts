/** The result of comparing two knowledge items against configured similarity thresholds. */
export enum SimilarityClassification {
  Duplicate = "duplicate",
  NearDuplicate = "near_duplicate",
  Related = "related",
  Distinct = "distinct",
}
