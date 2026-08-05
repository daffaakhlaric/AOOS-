import type { ExecutionSession } from "./execution-session.js";

/** The internal result of walking an `ExecutionGraph` end-to-end — never exposed outside `engine/`. A `success: false` outcome is a normal "business" completion (a Node failed and no Failure Transition resolved it), not a thrown exception. */
export interface GraphRunOutcome {
  readonly session: ExecutionSession;
  readonly success: boolean;
  readonly error?: string;
}
