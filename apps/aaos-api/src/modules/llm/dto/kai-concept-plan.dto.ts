import { z } from "zod";
const text = z.string().trim().min(1).max(2000);
export const KaiConceptPlanSchema = z.object({
  concepts: z
    .array(
      z.object({
        title: text,
        family: z.enum([
          "LOCATION",
          "PRICE_VALUE",
          "LIFESTYLE",
          "PROPERTY_FEATURES",
          "WALKTHROUGH",
          "INVESTMENT",
        ]),
        hypothesis: text,
        persona: text,
        visualDirection: text,
        claimIndices: z.array(z.number().int().nonnegative()).min(1).max(10),
        scenes: z
          .array(
            z.object({
              purpose: text,
              visualDirection: text,
              claimIndex: z.number().int().nonnegative(),
            }),
          )
          .min(1)
          .max(8),
      }),
    )
    .min(1)
    .max(10),
});
export type KaiConceptPlan = z.infer<typeof KaiConceptPlanSchema>;
