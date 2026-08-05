import type { KnowledgeRuntimeExecution } from "../domain/knowledge-runtime-execution.js";

export interface IKnowledgeRuntimeLifecycle {
  load(execution: KnowledgeRuntimeExecution): KnowledgeRuntimeExecution;
  markLoaded(execution: KnowledgeRuntimeExecution): KnowledgeRuntimeExecution;
  validate(execution: KnowledgeRuntimeExecution): KnowledgeRuntimeExecution;
  markReady(execution: KnowledgeRuntimeExecution): KnowledgeRuntimeExecution;
  start(execution: KnowledgeRuntimeExecution): KnowledgeRuntimeExecution;
  suspend(execution: KnowledgeRuntimeExecution, reason?: string): KnowledgeRuntimeExecution;
  resume(execution: KnowledgeRuntimeExecution): KnowledgeRuntimeExecution;
  markResumed(execution: KnowledgeRuntimeExecution): KnowledgeRuntimeExecution;
  complete(execution: KnowledgeRuntimeExecution): KnowledgeRuntimeExecution;
  fail(execution: KnowledgeRuntimeExecution, reason?: string): KnowledgeRuntimeExecution;
  cancel(execution: KnowledgeRuntimeExecution, reason?: string): KnowledgeRuntimeExecution;
  expire(execution: KnowledgeRuntimeExecution): KnowledgeRuntimeExecution;
  destroy(execution: KnowledgeRuntimeExecution): KnowledgeRuntimeExecution;
}
