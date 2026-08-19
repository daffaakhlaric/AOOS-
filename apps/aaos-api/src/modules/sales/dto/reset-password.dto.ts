import { z } from "zod";

/** `POST /api/v1/sales-humans/:id/reset-password` body (Part 1's "Reset Password" modal). */
export const ResetPasswordBodySchema = z.object({
  password: z.string().min(8, "password must be at least 8 characters"),
});

export type ResetPasswordBodyDto = z.infer<typeof ResetPasswordBodySchema>;
