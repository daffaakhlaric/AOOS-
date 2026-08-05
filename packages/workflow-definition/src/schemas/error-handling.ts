import { z } from "zod";

/** Error Handling Contract (docs/PROMPT-005.6A-WORKFLOW-DEFINITION-LANGUAGE.md — "WORKFLOW ROOT: Error Handling") — definition metadata only, no error is ever caught by this package. */
export const errorHandlingSchema = z.object({
  /** Transition id to follow when an unhandled error occurs anywhere in the Workflow. */
  onErrorTransitionId: z.string().min(1).optional(),
  /** Whether an unhandled Node error propagates to the parent Workflow (for a `SubWorkflow` node) or is swallowed here. */
  propagate: z.boolean().default(true),
});

export type ErrorHandling = z.infer<typeof errorHandlingSchema>;
