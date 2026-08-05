import type { BaseEventShape } from "@aos/event-bus";

import type { ExecutionToken } from "../instance/execution-token.js";

/**
 * "Replay. Implement interface only. Integrate with Event Replay interface from Event
 * Bus. No replay execution." (docs/PROMPT-005.6B-WORKFLOW-RUNTIME-CORE.md). Wraps
 * `@aos/event-bus`'s `IEventReplay` concept, scoped to one Workflow Instance's
 * `ExecutionToken` — no implementing class exists in this package.
 * `runtime/workflow-runtime.ts#replay()` accepts an optional `IWorkflowReplay` and throws
 * `ReplayNotSupportedException` when none is configured.
 */
export interface IWorkflowReplay {
  replayInstance(
    token: ExecutionToken,
  ): AsyncIterable<BaseEventShape> | Promise<readonly BaseEventShape[]>;
}
