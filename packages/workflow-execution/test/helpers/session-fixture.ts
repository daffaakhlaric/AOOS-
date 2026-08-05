import type { WorkflowDefinition } from "@aos/workflow-definition";

import { createExecutionContext } from "../../src/context/create-execution-context.js";
import { createExecutionCursor } from "../../src/cursor/create-execution-cursor.js";
import type { ExecutionSession } from "../../src/engine/execution-session.js";
import { buildExecutionGraph } from "../../src/graph/execution-graph.js";
import type { ExecutionGraph } from "../../src/graph/execution-graph.js";
import { EMPTY_EXECUTION_STATISTICS } from "../../src/result/execution-statistics.js";
import { ExecutionState } from "../../src/state-machine/execution-state.js";
import { createExecutionToken } from "../../src/token/create-execution-token.js";

import { definitionFixture } from "./definition-fixture.js";

export function sessionFixture(
  overrides: {
    readonly definition?: WorkflowDefinition;
    readonly currentState?: ExecutionState;
  } = {},
): { readonly session: ExecutionSession; readonly graph: ExecutionGraph } {
  const definition = overrides.definition ?? definitionFixture();
  const graph = buildExecutionGraph(definition);
  const token = createExecutionToken({ workflowInstanceId: "wf-instance-1" });
  const context = createExecutionContext({ token });
  const cursor = createExecutionCursor(graph.startNodeId);
  const session: ExecutionSession = {
    definition,
    context: { ...context, currentState: overrides.currentState ?? ExecutionState.CREATED },
    cursor,
    history: [],
    statistics: EMPTY_EXECUTION_STATISTICS,
  };
  return { session, graph };
}
