import { z } from "zod";

/** Free-form Workflow Instance extension bag — not interpreted by this package (mirrors `@aos/workflow-definition`'s `WorkflowMetadata`). */
export const workflowInstanceMetadataSchema = z.record(z.string(), z.unknown());
export type WorkflowInstanceMetadata = z.infer<typeof workflowInstanceMetadataSchema>;
