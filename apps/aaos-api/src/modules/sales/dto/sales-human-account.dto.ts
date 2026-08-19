/**
 * JSON-serializable projection of a real `sales_humans` row + its linked Supabase Auth user's
 * `email`/`last_sign_in_at` (coordinator note #1 — email is never persisted on the row itself).
 * Named `...Account...` (not `SalesHumanResponseDto`, already taken by
 * `modules/branches/dto/branch-response.dto.ts`'s branch-manager-sourced projection — a
 * deliberately distinct, unrelated in-memory concept, see `sales-humans.service.ts`'s class doc).
 */
export interface SalesHumanAccountResponseDto {
  readonly id: string;
  readonly name: string;
  readonly email: string | undefined;
  readonly phone: string;
  readonly branchId: string;
  readonly status: "ON" | "BUSY" | "OFF";
  readonly maxLeadsPerDay: number;
  readonly createdAt: string;
  readonly lastSignInAt: string | undefined;
}
