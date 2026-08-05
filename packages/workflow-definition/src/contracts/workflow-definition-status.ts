/** The Workflow Definition Registry's lifecycle status for a stored definition — mirrors `@aos/registry`'s `EntryStatus` pattern, scoped to this package's own Registry. */
export enum WorkflowDefinitionStatus {
  DRAFT = "draft",
  PUBLISHED = "published",
  DEPRECATED = "deprecated",
  RETIRED = "retired",
}

export const WORKFLOW_DEFINITION_STATUS_TRANSITIONS: Readonly<
  Record<WorkflowDefinitionStatus, readonly WorkflowDefinitionStatus[]>
> = {
  [WorkflowDefinitionStatus.DRAFT]: [
    WorkflowDefinitionStatus.PUBLISHED,
    WorkflowDefinitionStatus.RETIRED,
  ],
  [WorkflowDefinitionStatus.PUBLISHED]: [
    WorkflowDefinitionStatus.DEPRECATED,
    WorkflowDefinitionStatus.RETIRED,
  ],
  [WorkflowDefinitionStatus.DEPRECATED]: [WorkflowDefinitionStatus.RETIRED],
  [WorkflowDefinitionStatus.RETIRED]: [],
};
