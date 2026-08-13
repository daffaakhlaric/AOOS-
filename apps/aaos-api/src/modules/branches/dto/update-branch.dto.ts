import { z } from "zod";

/**
 * `PUT /api/v1/branches/:id` body — AAOS-W4A coordinator note #5: `@aos/branch-manager` has no
 * single generic "update branch" use case, so every field here is optional and independently
 * dispatched by `BranchesService.updateBranch` to the matching underlying use case:
 *   - `assignmentMode`/`maxLeadsPerSalesPerDay` -> rebuild + `BranchRegistry.update`
 *   - `updateSalesStatus[]`                     -> `UpdateSalesStatus.execute` per entry
 *   - `addSales[]`                              -> `AddSalesHuman.execute` per entry
 *   - `removeSalesHumanIds[]`                   -> `RemoveSalesHuman.execute` per entry
 * A request may combine any subset of these in one call (e.g. the "Branch Settings" page's
 * "Simpan Perubahan" button submits assignment-mode + max-leads-per-day together).
 */
export const UpdateBranchBodySchema = z.object({
  assignmentMode: z.enum(["SMART_ASSIGN", "ROUND_ROBIN", "MANUAL"]).optional(),
  maxLeadsPerSalesPerDay: z.number().int().positive().optional(),
  addSales: z
    .array(
      z.object({
        name: z.string().min(1),
        waNumber: z.string().min(1),
        status: z.enum(["ON", "BUSY", "OFF"]).optional(),
        maxLeadsPerDay: z.number().int().positive().optional(),
      }),
    )
    .optional(),
  removeSalesHumanIds: z.array(z.string().min(1)).optional(),
  updateSalesStatus: z
    .array(
      z.object({
        salesHumanId: z.string().min(1),
        status: z.enum(["ON", "BUSY", "OFF"]),
      }),
    )
    .optional(),
});

export type UpdateBranchBodyDto = z.infer<typeof UpdateBranchBodySchema>;
