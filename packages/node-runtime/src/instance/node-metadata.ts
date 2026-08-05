import { z } from "zod";

/** Free-form Node Instance extension bag — not interpreted by this package. */
export const nodeMetadataSchema = z.record(z.string(), z.unknown());
export type NodeMetadata = z.infer<typeof nodeMetadataSchema>;
