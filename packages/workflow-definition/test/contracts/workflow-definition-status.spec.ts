import { describe, expect, it } from "vitest";

import {
  WORKFLOW_DEFINITION_STATUS_TRANSITIONS,
  WorkflowDefinitionStatus,
} from "../../src/contracts/workflow-definition-status.js";

describe("WORKFLOW_DEFINITION_STATUS_TRANSITIONS", () => {
  it("every status has a transition table entry", () => {
    for (const status of Object.values(WorkflowDefinitionStatus)) {
      expect(WORKFLOW_DEFINITION_STATUS_TRANSITIONS[status]).toBeDefined();
    }
  });

  it("Retired is terminal", () => {
    expect(WORKFLOW_DEFINITION_STATUS_TRANSITIONS[WorkflowDefinitionStatus.RETIRED]).toEqual([]);
  });

  it("Draft can move to Published or Retired", () => {
    expect(WORKFLOW_DEFINITION_STATUS_TRANSITIONS[WorkflowDefinitionStatus.DRAFT]).toEqual([
      WorkflowDefinitionStatus.PUBLISHED,
      WorkflowDefinitionStatus.RETIRED,
    ]);
  });

  it("Published can move to Deprecated or Retired", () => {
    expect(WORKFLOW_DEFINITION_STATUS_TRANSITIONS[WorkflowDefinitionStatus.PUBLISHED]).toEqual([
      WorkflowDefinitionStatus.DEPRECATED,
      WorkflowDefinitionStatus.RETIRED,
    ]);
  });
});
