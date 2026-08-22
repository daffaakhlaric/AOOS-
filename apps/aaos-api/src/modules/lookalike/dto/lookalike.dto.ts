import { z } from "zod";

/** `POST /api/v1/lookalike/audiences/lookalike` — "Buat Lookalike N%" button (spec's Lookalike 1%/2%/3% cards). */
export const CreateLookalikeBodySchema = z.object({
  percentage: z.union([z.literal(1), z.literal(2), z.literal(3)]),
});
export type CreateLookalikeBodyDto = z.infer<typeof CreateLookalikeBodySchema>;
