import type { SupabaseClientLike } from "@aos/lead-store";
import {
  Inject,
  Injectable,
  ConflictException,
  ServiceUnavailableException,
  BadRequestException,
} from "@nestjs/common";

import { SUPABASE_CLIENT } from "../../di-tokens.js";
import { ActivityLogger } from "../activity-log/activity-logger.service.js";
import { ModeGuardService } from "../mode-guard/mode-guard.service.js";

import {
  defaultGrowthPolicy,
  GrowthPolicySchema,
  PACE_PROFILES,
  type GrowthPolicy,
} from "./domain/growth-policy.js";
import { growthReadiness } from "./domain/growth-readiness.js";

interface Row {
  tenant_id: string;
  version: number;
  policy: GrowthPolicy;
  updated_at: string;
  changed_by: string;
}
interface Rpc {
  rpc(
    name: string,
    args: Record<string, unknown>,
  ): PromiseLike<{ data: unknown; error: { message: string } | null }>;
}
@Injectable()
export class GrowthPolicyService {
  constructor(
    @Inject(SUPABASE_CLIENT) private readonly db: SupabaseClientLike,
    private readonly activity: ActivityLogger,
    private readonly mode: ModeGuardService,
  ) {}
  async current(tenant: string) {
    const r = await this.db
      .from<Row>("growth_policies")
      .select("*")
      .eq("tenant_id", tenant)
      .maybeSingle();
    if (r.error)
      throw new ServiceUnavailableException("Growth Policy belum tersedia. Periksa migrasi 069.");
    return {
      version: r.data?.version ?? 0,
      policy: r.data ? GrowthPolicySchema.parse(r.data.policy) : defaultGrowthPolicy(),
      updatedAt: r.data?.updated_at ?? null,
    };
  }
  async view(tenant: string) {
    const current = await this.current(tenant);
    const connection = await this.db
      .from<{
        meta_ad_account_id: string | null;
        meta_access_token: string | null;
        meta_access_token_encrypted: string | null;
        meta_token_expires_at: string | null;
      }>("tenants")
      .select(
        "meta_ad_account_id,meta_access_token,meta_access_token_encrypted,meta_token_expires_at",
      )
      .eq("tenant_id", tenant)
      .maybeSingle();
    const t = connection.data;
    const metaConfigured =
      !connection.error &&
      !!t?.meta_ad_account_id &&
      !!(t.meta_access_token || t.meta_access_token_encrypted) &&
      (!t.meta_token_expires_at || Date.parse(t.meta_token_expires_at) > Date.now());
    return {
      ...current,
      defaults: defaultGrowthPolicy(),
      paceProfiles: PACE_PROFILES,
      readiness: growthReadiness(current.policy, {
        metaConfigured,
        schedulerEnabled: process.env["ADVERTISING_LOOP_RUNTIME_V2"] === "true",
        creativeConfigured: !!process.env["KIE_AI_API_KEY"],
      }),
      estimate: {
        status: "UNAVAILABLE",
        reason: "Belum cukup data outcome terverifikasi untuk membuat estimasi.",
      },
    };
  }
  async save(tenant: string, expected: number, input: unknown, actor: string, reason?: string) {
    const parsed = GrowthPolicySchema.safeParse(input);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    // Persist the requested mode independently of capability readiness. Saving never grants
    // execution eligibility: the runtime and per-action guards still block unsupported actions.
    const before = await this.current(tenant);
    const mode = await this.mode.resolveMode(tenant);
    const r = await (this.db as unknown as Rpc).rpc("save_growth_policy", {
      p_tenant: tenant,
      p_expected: expected,
      p_policy: parsed.data,
      p_actor: actor,
      p_reason: reason ?? null,
    });
    if (r.error?.message.includes("STALE_POLICY"))
      throw new ConflictException("STALE_POLICY: muat ulang pengaturan sebelum menyimpan.");
    if (r.error) throw new ServiceUnavailableException("Growth Policy gagal disimpan.");
    const id = await this.activity.start({
      tenantId: tenant,
      agent: "USER",
      actionType: "GROWTH_POLICY_UPDATED",
      mode,
      input: { actor, previousVersion: before.version, newVersion: expected + 1 },
    });
    await this.activity.complete(id, {
      status: "SUCCESS",
      output: {
        before: {
          objective: before.policy.growthObjective,
          pace: before.policy.pace,
          mode: before.policy.autonomousMode,
        },
        after: {
          objective: parsed.data.growthObjective,
          pace: parsed.data.pace,
          mode: parsed.data.autonomousMode,
        },
        version: expected + 1,
      },
    });
    return this.view(tenant);
  }
  async versions(tenant: string) {
    const r = await this.db
      .from("growth_policy_versions")
      .select("*")
      .eq("tenant_id", tenant)
      .order("version", { ascending: false })
      .limit(50);
    if (r.error) throw new ServiceUnavailableException("Riwayat Growth Policy belum tersedia.");
    return r.data ?? [];
  }
}
