import { z } from "zod";

/** Labels — key/value pairs (docs/PROMPT-005.6A-WORKFLOW-DEFINITION-LANGUAGE.md — "WORKFLOW ROOT"). */
export const labelsSchema = z.record(
  z
    .string()
    .min(1)
    .regex(/^[a-z][a-z0-9_.-]*$/, "label key must be lowercase, alphanumeric, '_', '.', or '-'"),
  z.string(),
);
export type Labels = z.infer<typeof labelsSchema>;

/** Tags — a flat list of free-form strings. */
export const tagsSchema = z.array(z.string().min(1));
export type Tags = z.infer<typeof tagsSchema>;

/** Free-form extension bag — not interpreted by this package. */
export const workflowMetadataSchema = z.record(z.string(), z.unknown());
export type WorkflowMetadata = z.infer<typeof workflowMetadataSchema>;
