import { KnowledgeAutoUpdateException } from "./knowledge-auto-update-exception.js";

export class ValidationFailedException extends KnowledgeAutoUpdateException {
  constructor(subject: string, reasons: readonly string[]) {
    super(`Validation failed for ${subject}: ${reasons.join("; ")}`, {
      code: "VALIDATION_FAILED",
      context: { subject, reasons },
    });
  }
}
