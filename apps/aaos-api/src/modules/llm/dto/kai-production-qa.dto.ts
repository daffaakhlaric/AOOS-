import { z } from "zod";
export const KaiProductionQaSchema = z.object({
  propertyConsistent: z.boolean(),
  copyCorrect: z.boolean(),
  noUnsupportedClaims: z.boolean(),
  reasoning: z.string().min(1).max(4000),
});
