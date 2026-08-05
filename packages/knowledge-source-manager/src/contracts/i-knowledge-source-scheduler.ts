import type { KnowledgeSourceScheduleDescriptor } from "../scheduler/knowledge-source-schedule-descriptor.js";

/**
 * Interface only — no timer/cron implementation anywhere in this package. "SCHEDULER:
 * Metadata only." (docs/PROMPT-005.7G-KNOWLEDGE-SOURCE-MANAGER.md). A real scheduling
 * engine belongs to a future roadmap phase (e.g. `@aos/scheduler` wiring) and would
 * implement this shape to actually fire Source syncs described by a
 * `KnowledgeSourceScheduleDescriptor`.
 */
export interface IKnowledgeSourceScheduler {
  validate(descriptor: KnowledgeSourceScheduleDescriptor): boolean;
  describe(descriptor: KnowledgeSourceScheduleDescriptor): string;
}
