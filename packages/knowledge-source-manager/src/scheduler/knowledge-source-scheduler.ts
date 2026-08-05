import type { IKnowledgeSourceScheduler } from "../contracts/i-knowledge-source-scheduler.js";
import { SourceScheduleException } from "../errors/source-schedule-exception.js";

import type { KnowledgeSourceScheduleDescriptor } from "./knowledge-source-schedule-descriptor.js";
import { KnowledgeSourceScheduleMode } from "./knowledge-source-schedule-mode.js";

/**
 * "KnowledgeSourceScheduler" (docs/PROMPT-005.7G-KNOWLEDGE-SOURCE-MANAGER.md — "PUBLIC
 * API") — "Metadata only." This class validates and describes a Schedule descriptor; it
 * never registers a real timer, cron job, or `@aos/scheduler` execution. Real enforcement
 * (not a stub): Cron mode requires `cronExpression`, Interval mode requires
 * `intervalMs`, One Time mode requires `runAt`, Future Event mode requires `eventName`;
 * Manual mode requires none of them.
 */
export class KnowledgeSourceScheduler implements IKnowledgeSourceScheduler {
  validate(descriptor: KnowledgeSourceScheduleDescriptor): boolean {
    try {
      this.assertValid(descriptor);
      return true;
    } catch {
      return false;
    }
  }

  assertValid(descriptor: KnowledgeSourceScheduleDescriptor): void {
    switch (descriptor.mode) {
      case KnowledgeSourceScheduleMode.CRON:
        if (!descriptor.cronExpression) {
          throw new SourceScheduleException("Cron Schedule mode requires a cronExpression");
        }
        break;
      case KnowledgeSourceScheduleMode.INTERVAL:
        if (!descriptor.intervalMs) {
          throw new SourceScheduleException("Interval Schedule mode requires an intervalMs");
        }
        break;
      case KnowledgeSourceScheduleMode.ONE_TIME:
        if (!descriptor.runAt) {
          throw new SourceScheduleException("One Time Schedule mode requires a runAt timestamp");
        }
        break;
      case KnowledgeSourceScheduleMode.FUTURE_EVENT:
        if (!descriptor.eventName) {
          throw new SourceScheduleException("Future Event Schedule mode requires an eventName");
        }
        break;
      case KnowledgeSourceScheduleMode.MANUAL:
        break;
    }
  }

  describe(descriptor: KnowledgeSourceScheduleDescriptor): string {
    this.assertValid(descriptor);
    switch (descriptor.mode) {
      case KnowledgeSourceScheduleMode.CRON:
        return `Cron("${descriptor.cronExpression}")`;
      case KnowledgeSourceScheduleMode.INTERVAL:
        return `Interval(${descriptor.intervalMs}ms)`;
      case KnowledgeSourceScheduleMode.ONE_TIME:
        return `OneTime(${descriptor.runAt})`;
      case KnowledgeSourceScheduleMode.FUTURE_EVENT:
        return `FutureEvent("${descriptor.eventName}")`;
      case KnowledgeSourceScheduleMode.MANUAL:
        return "Manual";
    }
  }
}
