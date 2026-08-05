import {
  KnowledgeSourceException,
  type KnowledgeSourceExceptionOptions,
} from "./knowledge-source-exception.js";

/** Thrown by `KnowledgeSourceScheduler#assertValid()` when a Schedule descriptor is missing the field its Mode requires (e.g. Cron without `cronExpression`, Interval without `intervalMs`). Metadata-only — never wired to a real timer/cron library. */
export class SourceScheduleException extends KnowledgeSourceException {
  constructor(message: string, options: KnowledgeSourceExceptionOptions = {}) {
    super(message, options);
  }
}
