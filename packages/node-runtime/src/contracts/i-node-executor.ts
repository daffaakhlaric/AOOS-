import type { NodeCategory } from "./node-category.js";

/**
 * "NODE EXECUTOR: Create ONLY interfaces. Do NOT implement execution."
 * (docs/PROMPT-005.6C-ENTERPRISE-NODE-RUNTIME.md). No class in this package implements
 * any of these — they declare the extension point a future Execution Engine (005.6D)
 * implements per Node Type/Category.
 */
export interface INodeExecutionContext {
  readonly nodeInstanceId: string;
  readonly workflowInstanceId: string;
  readonly executionId: string;
  readonly input: Readonly<Record<string, unknown>>;
  readonly variables: Readonly<Record<string, unknown>>;
}

export interface INodeExecutionResult {
  readonly success: boolean;
  readonly output?: Readonly<Record<string, unknown>>;
  readonly error?: string;
}

export interface INodeExecutor {
  readonly category: NodeCategory;
  execute(context: INodeExecutionContext): Promise<INodeExecutionResult>;
}

/** The dispatch point a future Execution Engine uses to pick an `INodeExecutor` per Node Type/Category. */
export interface INodeExecutionStrategy {
  resolve(category: NodeCategory): INodeExecutor | undefined;
}
