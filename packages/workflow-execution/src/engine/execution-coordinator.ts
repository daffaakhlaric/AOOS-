import { ExecutionNotFoundException } from "../errors/execution-not-found-exception.js";

import type { ExecutionSession } from "./execution-session.js";

/** Internal to `engine/` — the in-memory `Map<workflowExecutionId, ExecutionSession>` every imperative Engine operation looks a live Session up through. Not part of this package's public API. */
export class ExecutionCoordinator {
  private readonly sessionsByToken = new Map<string, ExecutionSession>();

  register(session: ExecutionSession): ExecutionSession {
    this.sessionsByToken.set(session.context.token.workflowExecutionId, session);
    return session;
  }

  get(workflowExecutionId: string): ExecutionSession | undefined {
    return this.sessionsByToken.get(workflowExecutionId);
  }

  require(workflowExecutionId: string): ExecutionSession {
    const session = this.sessionsByToken.get(workflowExecutionId);
    if (!session) {
      throw new ExecutionNotFoundException(
        `No Execution Session is registered for id "${workflowExecutionId}"`,
      );
    }
    return session;
  }

  update(session: ExecutionSession): ExecutionSession {
    this.require(session.context.token.workflowExecutionId);
    this.sessionsByToken.set(session.context.token.workflowExecutionId, session);
    return session;
  }

  list(): readonly ExecutionSession[] {
    return Array.from(this.sessionsByToken.values());
  }
}
