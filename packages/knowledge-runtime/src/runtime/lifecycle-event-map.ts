import { KnowledgeRuntimeEventType } from "../events/knowledge-runtime-event-type.js";
import type { LifecycleOperation } from "../middleware/lifecycle-middleware.js";

/**
 * Maps each `LifecycleOperation` to the `KnowledgeRuntimeEventType` `KnowledgeRuntime`
 * publishes after it succeeds. `load`/`validate`/`resume` are the "begin transitioning"
 * half of a two-step move (`LOADING`/`VALIDATING`/`RESUMING`) and have no event of their
 * own in the source prompt's 12-event list — only the "settled" half
 * (`markLoaded`/`markReady`/`markResumed`) publishes.
 */
export const LIFECYCLE_EVENT_MAP: Readonly<
  Record<LifecycleOperation, KnowledgeRuntimeEventType | undefined>
> = {
  load: undefined,
  markLoaded: KnowledgeRuntimeEventType.LOADED,
  validate: undefined,
  markReady: KnowledgeRuntimeEventType.READY,
  start: KnowledgeRuntimeEventType.STARTED,
  suspend: KnowledgeRuntimeEventType.SUSPENDED,
  resume: undefined,
  markResumed: KnowledgeRuntimeEventType.RESUMED,
  complete: KnowledgeRuntimeEventType.COMPLETED,
  fail: KnowledgeRuntimeEventType.FAILED,
  cancel: KnowledgeRuntimeEventType.CANCELLED,
  expire: undefined,
  destroy: KnowledgeRuntimeEventType.DESTROYED,
};
