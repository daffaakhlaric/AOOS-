import { z } from "zod";

/** Free-form Execution extension bag — not interpreted by this package. */
export const executionMetadataSchema = z.record(z.string(), z.unknown());
export type ExecutionMetadata = z.infer<typeof executionMetadataSchema>;
