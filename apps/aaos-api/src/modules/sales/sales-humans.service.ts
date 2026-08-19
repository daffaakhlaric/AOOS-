import { ALL_BRANCH_IDS } from "@aos/branch-manager";
import { ConflictError, NotFoundError, ValidationError } from "@aos/errors";
import { Inject, Injectable } from "@nestjs/common";

import type { AaosApiConfig } from "../../config/aaos-api.config.js";
import { AAOS_API_CONFIG, SUPABASE_AUTH_ADMIN } from "../../di-tokens.js";

import type { CreateSalesHumanBodyDto } from "./dto/create-sales-human.dto.js";
import type { SalesHumanAccountResponseDto } from "./dto/sales-human-account.dto.js";
import type { UpdateSalesHumanBodyDto } from "./dto/update-sales-human.dto.js";
import type { SalesHumanRow } from "./infrastructure/sales-human.repository.js";
import { SalesHumanRepository } from "./infrastructure/sales-human.repository.js";
import type {
  SupabaseAuthAdminLike,
  SupabaseAuthUserLike,
} from "./infrastructure/supabase-auth-admin.js";

function toDto(
  row: SalesHumanRow,
  authUser: SupabaseAuthUserLike | undefined,
): SalesHumanAccountResponseDto {
  return {
    id: row.id,
    name: row.name,
    email: authUser?.email,
    phone: row.wa_number,
    branchId: row.branch_id,
    status: row.status as "ON" | "BUSY" | "OFF",
    maxLeadsPerDay: row.max_leads_per_day,
    createdAt: row.created_at,
    lastSignInAt: authUser?.last_sign_in_at ?? undefined,
  };
}

function assertKnownBranch(branchId: string): void {
  const found = (ALL_BRANCH_IDS as readonly string[]).find((id) => id === branchId.toUpperCase());
  if (found === undefined) {
    throw new ValidationError(
      `Unknown branchId "${branchId}" — expected one of: ${ALL_BRANCH_IDS.join(", ")}`,
    );
  }
}

/**
 * `apps/aaos-api/src/modules/sales`'s account-provisioning service (AAOS-SALES-MGMT-CRM-AUTH) —
 * the real integration coordinator note #1 corrects the raw spec's Parts 2-5 to: every "add/edit/
 * reset a sales human" operation goes through Supabase Auth's Admin API (`SUPABASE_AUTH_ADMIN`) for
 * the credential half and the real `sales_humans` table (`SalesHumanRepository`) for the profile
 * half — never a custom `bcrypt`/`@nestjs/jwt` system.
 *
 * DELIBERATELY OUT OF SCOPE: `@aos/branch-manager`'s `SalesTeamRegistry` (the in-memory store
 * `GET/PUT /api/v1/branches` reads/writes, used for lead-assignment ROUTING eligibility) is a
 * separate, pre-existing, process-local concept from this table — verified via direct file reads
 * (`packages/branch-manager/src/registry/SalesTeamRegistry.ts` is a plain `Map`, seeded empty at
 * boot, never persisted). This service does not write to it: a sales human added here is a real,
 * durable, login-capable account, but will not yet be eligible for SmartAssign/RoundRobin routing
 * until that separate in-memory registry is also populated — a pre-existing gap this task's
 * corrected scope (Supabase Auth + the `sales_humans` table) does not attempt to close. Documented
 * explicitly in the final report.
 */
@Injectable()
export class SalesHumansService {
  constructor(
    private readonly repository: SalesHumanRepository,
    @Inject(SUPABASE_AUTH_ADMIN) private readonly authAdmin: SupabaseAuthAdminLike,
    @Inject(AAOS_API_CONFIG) private readonly config: AaosApiConfig,
  ) {}

  /** Builds an `authUserId -> SupabaseAuthUserLike` map with ONE `listUsers` call (never N `getUserById` calls per list request). `perPage: 1000` is generous for DSS Motor's real team sizes (a handful of sales humans per branch); pagination would be a real, currently-unneeded addition if the tenant ever exceeds it. */
  private async loadAuthUsersById(): Promise<ReadonlyMap<string, SupabaseAuthUserLike>> {
    const { data, error } = await this.authAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 });
    if (error !== null) {
      throw new ValidationError(`Failed to load Supabase Auth users: ${error.message}`);
    }
    const map = new Map<string, SupabaseAuthUserLike>();
    for (const user of data?.users ?? []) {
      map.set(user.id, user);
    }
    return map;
  }

  async list(branchId?: string): Promise<readonly SalesHumanAccountResponseDto[]> {
    if (branchId !== undefined) {
      assertKnownBranch(branchId);
    }
    const [rows, authUsersById] = await Promise.all([
      this.repository.list(this.config.AAOS_TENANT_ID, branchId?.toUpperCase()),
      this.loadAuthUsersById(),
    ]);
    return rows.map((row) =>
      toDto(row, row.auth_user_id !== null ? authUsersById.get(row.auth_user_id) : undefined),
    );
  }

  /**
   * (1) provisions a real Supabase Auth user, (2) inserts the `sales_humans` row with
   * `auth_user_id` set to that user's real id, (3) patches the Auth user's `user_metadata` with the
   * now-known `salesHumanId` (the row's own generated `id`) — `useSalesSession()`/`getSession()`'s
   * `extractSalesHumanId` read exactly this field, so it must equal the real row id, not a
   * placeholder chosen before the row existed.
   */
  async create(dto: CreateSalesHumanBodyDto): Promise<SalesHumanAccountResponseDto> {
    const branchId = dto.branchId.toUpperCase();
    assertKnownBranch(branchId);

    const createResult = await this.authAdmin.auth.admin.createUser({
      email: dto.email,
      password: dto.password,
      email_confirm: true,
      user_metadata: { branchId, role: "sales" },
    });
    if (createResult.error !== null || createResult.data === null) {
      const message = createResult.error?.message ?? "Supabase Auth createUser returned no user";
      // Supabase's Admin API reports duplicate emails as a 4xx with "already been registered" in
      // the message — surfaced as a real 409, never a generic "gagal menambah sales" (coordinator
      // note #1's explicit requirement).
      if (/already.*registered|duplicate/i.test(message)) {
        throw new ConflictError(`Email "${dto.email}" sudah terdaftar: ${message}`);
      }
      throw new ValidationError(`Gagal membuat akun Supabase Auth: ${message}`);
    }
    const authUser = createResult.data.user;

    let row: SalesHumanRow;
    try {
      row = await this.repository.insert({
        tenant_id: this.config.AAOS_TENANT_ID,
        name: dto.name,
        wa_number: dto.phone ?? "",
        branch_id: branchId,
        status: dto.status ?? "ON",
        max_leads_per_day: dto.maxLeadsPerDay ?? 10,
        auth_user_id: authUser.id,
      });
    } catch (caught) {
      // The Auth user now exists without a matching row — best-effort cleanup so a failed create
      // doesn't leave an orphaned, unlisted-but-loginable account behind.
      await this.authAdmin.auth.admin.updateUserById(authUser.id, {
        user_metadata: { branchId, role: "sales", provisioningFailed: true },
      });
      throw caught;
    }

    await this.authAdmin.auth.admin.updateUserById(authUser.id, {
      user_metadata: { branchId, role: "sales", salesHumanId: row.id },
    });

    return toDto(row, authUser);
  }

  async update(id: string, dto: UpdateSalesHumanBodyDto): Promise<SalesHumanAccountResponseDto> {
    const existing = await this.repository.findById(id);
    if (existing === undefined) {
      throw new NotFoundError(`No sales human found for id "${id}"`);
    }
    if (dto.branchId !== undefined) {
      assertKnownBranch(dto.branchId);
    }

    let authUser: SupabaseAuthUserLike | undefined;
    if ((dto.email !== undefined || dto.password !== undefined) && existing.auth_user_id !== null) {
      const updateResult = await this.authAdmin.auth.admin.updateUserById(existing.auth_user_id, {
        ...(dto.email !== undefined ? { email: dto.email } : {}),
        ...(dto.password !== undefined ? { password: dto.password } : {}),
      });
      if (updateResult.error !== null || updateResult.data === null) {
        throw new ValidationError(
          `Gagal mengubah akun Supabase Auth: ${updateResult.error?.message ?? "unknown error"}`,
        );
      }
      authUser = updateResult.data.user;
    }

    const columnUpdates = {
      ...(dto.name !== undefined ? { name: dto.name } : {}),
      ...(dto.phone !== undefined ? { wa_number: dto.phone } : {}),
      ...(dto.branchId !== undefined ? { branch_id: dto.branchId.toUpperCase() } : {}),
      ...(dto.status !== undefined ? { status: dto.status } : {}),
      ...(dto.maxLeadsPerDay !== undefined ? { max_leads_per_day: dto.maxLeadsPerDay } : {}),
    };
    const row =
      Object.keys(columnUpdates).length > 0
        ? await this.repository.updateById(id, columnUpdates)
        : existing;

    if (authUser === undefined && row.auth_user_id !== null) {
      const fetched = await this.authAdmin.auth.admin.getUserById(row.auth_user_id);
      authUser = fetched.data?.user;
    }

    return toDto(row, authUser);
  }

  async resetPassword(id: string, password: string): Promise<SalesHumanAccountResponseDto> {
    const existing = await this.repository.findById(id);
    if (existing === undefined) {
      throw new NotFoundError(`No sales human found for id "${id}"`);
    }
    if (existing.auth_user_id === null) {
      throw new ValidationError(
        `Sales human "${id}" has no linked Supabase Auth account — cannot reset password.`,
      );
    }
    const result = await this.authAdmin.auth.admin.updateUserById(existing.auth_user_id, {
      password,
    });
    if (result.error !== null || result.data === null) {
      throw new ValidationError(
        `Gagal reset password: ${result.error?.message ?? "unknown error"}`,
      );
    }
    return toDto(existing, result.data.user);
  }
}
