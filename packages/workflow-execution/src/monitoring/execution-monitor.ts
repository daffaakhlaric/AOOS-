import type { ExecutionSession } from "../engine/execution-session.js";
import { ExecutionHealth } from "../health/execution-health.js";
import type { ExecutionHealthReport } from "../health/i-health-check.js";
import type {
  IExecutionMetrics,
  ExecutionMetricsSnapshot,
} from "../metrics/i-execution-metrics.js";
import type { ExecutionHistory } from "../result/execution-history.js";

export interface ExecutionSnapshot {
  readonly metrics: ExecutionMetricsSnapshot;
  readonly health: ExecutionHealthReport;
  readonly sampledAt: string;
}

/** "MONITORING: Execution Timeline, Execution Tree, Execution Graph, Execution History, Execution Trace" (docs/PROMPT-005.6D-WORKFLOW-EXECUTION-ENGINE.md). */
export interface ExecutionTreeNode {
  readonly nodeId: string;
  readonly children: readonly string[];
}

export interface ExecutionTrace {
  readonly traceId?: string;
  readonly correlationId: string;
  readonly history: ExecutionHistory;
}

/** Combines Metrics + Health into one sampled snapshot, and exposes Timeline/Tree/Trace views over one Execution Session. */
export class ExecutionMonitor {
  readonly health: ExecutionHealth;

  constructor(private readonly metrics: IExecutionMetrics) {
    this.health = new ExecutionHealth(() => this.metrics.snapshot());
  }

  sample(): ExecutionSnapshot {
    return {
      metrics: this.metrics.snapshot(),
      health: this.health.check(),
      sampledAt: new Date().toISOString(),
    };
  }

  /** "Execution Timeline" — the ordered `ExecutionHistory` of every State transition. */
  timeline(session: ExecutionSession): ExecutionHistory {
    return session.history;
  }

  /** "Execution Tree" — a parent→children view over the Nodes actually visited by the Cursor. */
  tree(session: ExecutionSession): readonly ExecutionTreeNode[] {
    const path = session.cursor.executionPath;
    const childrenByNode = new Map<string, string[]>();
    for (let i = 0; i < path.length - 1; i += 1) {
      const parent = path[i]!;
      const child = path[i + 1]!;
      const children = childrenByNode.get(parent) ?? [];
      if (!children.includes(child)) {
        children.push(child);
      }
      childrenByNode.set(parent, children);
    }
    return session.cursor.visitedNodes.map((nodeId) => ({
      nodeId,
      children: childrenByNode.get(nodeId) ?? [],
    }));
  }

  /** "Execution Trace" — the Trace/Correlation ids plus full History, ready for a downstream tracing backend. */
  trace(session: ExecutionSession): ExecutionTrace {
    return {
      traceId: session.context.token.traceId,
      correlationId: session.context.token.correlationId,
      history: session.history,
    };
  }
}
