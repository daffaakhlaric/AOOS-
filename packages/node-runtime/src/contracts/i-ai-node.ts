import type { INodeExecutionContext, INodeExecutionResult } from "./i-node-executor.js";

/**
 * "AI NODE: Do NOT call LLM. Create contracts only." (docs/PROMPT-005.6C-ENTERPRISE-NODE-RUNTIME.md).
 * No class in this package implements these — the extension point a future AI Gateway/
 * Model Router integration (out of scope here) implements.
 */
export interface IAIPromptProvider {
  render(templateId: string, variables: Readonly<Record<string, unknown>>): Promise<string>;
}

export interface IAIResponseHandler {
  handle(response: string, context: INodeExecutionContext): Promise<INodeExecutionResult>;
}

export interface IAINodeExecutor {
  readonly promptProvider: IAIPromptProvider;
  readonly responseHandler: IAIResponseHandler;
  execute(context: INodeExecutionContext): Promise<INodeExecutionResult>;
}
