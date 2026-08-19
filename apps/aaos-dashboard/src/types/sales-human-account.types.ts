/**
 * The real, Supabase-Auth-backed sales human account (AAOS-SALES-MGMT-CRM-AUTH) — mirrors
 * `apps/aaos-api`'s `SalesHumanAccountResponseDto` exactly. Deliberately separate from
 * `dashboard.types.ts`'s `SalesHumanDto` (that one is `@aos/branch-manager`'s in-memory,
 * non-persisted lead-assignment-routing view — see `apps/aaos-api/src/modules/sales/
 * sales-humans.service.ts`'s class doc for why the two are unrelated).
 */
export interface SalesHumanAccountDto {
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
