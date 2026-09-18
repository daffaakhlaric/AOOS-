import type { SupabaseClientLike } from "@aos/lead-store";

const TABLE = "campaign_creation_requests";

export type CampaignCreationRequestStatus =
  "PENDING" | "CREATED" | "PARTIAL_FAILURE" | "FAILED" | "SIMULATED";

/** Statuses that mean "nothing real exists on Meta yet from this row" — safe to reclaim and retry. */
const RECLAIMABLE_STATUSES: ReadonlySet<CampaignCreationRequestStatus> = new Set([
  "FAILED",
  "SIMULATED",
]);

export interface StoredCampaignCreationRequest {
  readonly id: string;
  readonly tenantId: string;
  readonly growthObjectiveId: string;
  readonly listingId: string;
  readonly creationRequestId: string;
  readonly blueprintId: string;
  readonly status: CampaignCreationRequestStatus;
  readonly metaCampaignId?: string;
  readonly metaAdSetId?: string;
  readonly errorMessage?: string;
  readonly createdAt: string;
  readonly updatedAt: string;
}

/** Raw `campaign_creation_requests` row shape (snake_case) — see `058_campaign_creation_requests.sql`. */
interface CampaignCreationRequestRow {
  readonly id: string;
  readonly tenant_id: string;
  readonly growth_objective_id: string;
  readonly listing_id: string;
  readonly creation_request_id: string;
  readonly blueprint_id: string;
  readonly status: string;
  readonly meta_campaign_id: string | null;
  readonly meta_ad_set_id: string | null;
  readonly error_message: string | null;
  readonly created_at: string;
  readonly updated_at: string;
}

export class CampaignCreationRepositoryError extends Error {}

function toDomain(row: CampaignCreationRequestRow): StoredCampaignCreationRequest {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    growthObjectiveId: row.growth_objective_id,
    listingId: row.listing_id,
    creationRequestId: row.creation_request_id,
    blueprintId: row.blueprint_id,
    status: row.status as CampaignCreationRequestStatus,
    metaCampaignId: row.meta_campaign_id ?? undefined,
    metaAdSetId: row.meta_ad_set_id ?? undefined,
    errorMessage: row.error_message ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * EYVRA — SAMANTHA V2 Phase 26 (PROMPT 37 — Campaign Creation Idempotency). Supabase-backed
 * persistence for `campaign_creation_requests` — see `058_campaign_creation_requests.sql`'s header
 * doc for why this is a dedicated table (not a reuse of `meta_campaigns`, which is a periodic sync
 * mirror with a completely different write-path discipline). Same hand-rolled
 * `SupabaseClientLike` port every other repository in this app uses
 * (`SimulationRepository`/`ListingRepository`/...) — no direct `@supabase/supabase-js` dependency.
 *
 * RACE SAFETY (the whole point of this class): `claim` relies on the table's own
 * `UNIQUE (tenant_id, growth_objective_id, listing_id)` constraint — a Postgres unique-violation
 * (`error.code === "23505"`) on insert means another request already claimed this exact key
 * concurrently; the caller re-reads via `findByKey` and treats it as a real duplicate/conflict,
 * never a fabricated success. `reclaim` performs an explicit compare-and-swap
 * (`UPDATE ... WHERE id = ? AND status = <the exact status the caller already read>`) — if a
 * concurrent reclaim already flipped the row's status, this UPDATE matches zero rows and
 * `maybeSingle()` returns `null`, so the caller can tell it lost the race and must NOT proceed to a
 * real Meta call.
 */
export class CampaignCreationRepository {
  constructor(private readonly client: SupabaseClientLike) {}

  async findByKey(
    tenantId: string,
    growthObjectiveId: string,
    listingId: string,
  ): Promise<StoredCampaignCreationRequest | undefined> {
    const { data, error } = await this.client
      .from<CampaignCreationRequestRow>(TABLE)
      .select("*")
      .eq("tenant_id", tenantId)
      .eq("growth_objective_id", growthObjectiveId)
      .eq("listing_id", listingId)
      .maybeSingle();
    if (error !== null) {
      throw new CampaignCreationRepositoryError(
        `CampaignCreationRepository.findByKey failed: ${error.message}`,
      );
    }
    return data === null ? undefined : toDomain(data);
  }

  /**
   * Attempts to claim a brand-new idempotency slot (no existing row for this key). Returns
   * `undefined` — never throws — on a unique-constraint conflict (`error.code === "23505"`): the
   * caller is expected to `findByKey` again and handle the now-existing row honestly. Any OTHER
   * database error still throws `CampaignCreationRepositoryError`.
   */
  async claim(input: {
    readonly tenantId: string;
    readonly growthObjectiveId: string;
    readonly listingId: string;
    readonly creationRequestId: string;
    readonly blueprintId: string;
  }): Promise<StoredCampaignCreationRequest | undefined> {
    const { data, error } = await this.client
      .from<CampaignCreationRequestRow>(TABLE)
      .insert({
        tenant_id: input.tenantId,
        growth_objective_id: input.growthObjectiveId,
        listing_id: input.listingId,
        creation_request_id: input.creationRequestId,
        blueprint_id: input.blueprintId,
        status: "PENDING",
      })
      .select("*")
      .single();
    if (error !== null) {
      if (error.code === "23505") {
        return undefined;
      }
      throw new CampaignCreationRepositoryError(
        `CampaignCreationRepository.claim failed: ${error.message}`,
      );
    }
    if (data === null) {
      throw new CampaignCreationRepositoryError(
        "CampaignCreationRepository.claim: no row returned",
      );
    }
    return toDomain(data);
  }

  /**
   * Compare-and-swap reclaim of an existing row that is `FAILED`/`SIMULATED` (see
   * `RECLAIMABLE_STATUSES` — nothing real exists on Meta for either status) back to `PENDING` for a
   * fresh attempt, clearing any stale `meta_campaign_id`/`meta_ad_set_id`/`error_message`. Guarded
   * by `.eq("status", fromStatus)` — if the row's status no longer matches what the caller read
   * (another process reclaimed it first), this matches zero rows and returns `undefined`; the
   * caller must treat that as "lost the race", never proceed to a real Meta call.
   */
  async reclaim(
    id: string,
    fromStatus: CampaignCreationRequestStatus,
    input: { readonly creationRequestId: string; readonly blueprintId: string },
  ): Promise<StoredCampaignCreationRequest | undefined> {
    if (!RECLAIMABLE_STATUSES.has(fromStatus)) {
      throw new CampaignCreationRepositoryError(
        `CampaignCreationRepository.reclaim: status "${fromStatus}" is not reclaimable`,
      );
    }
    const { data, error } = await this.client
      .from<CampaignCreationRequestRow>(TABLE)
      .update({
        status: "PENDING",
        creation_request_id: input.creationRequestId,
        blueprint_id: input.blueprintId,
        meta_campaign_id: null,
        meta_ad_set_id: null,
        error_message: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .eq("status", fromStatus)
      .select("*")
      .maybeSingle();
    if (error !== null) {
      throw new CampaignCreationRepositoryError(
        `CampaignCreationRepository.reclaim failed: ${error.message}`,
      );
    }
    return data === null ? undefined : toDomain(data);
  }

  async markCreated(id: string, metaCampaignId: string, metaAdSetId: string): Promise<void> {
    const { error } = await this.client
      .from<CampaignCreationRequestRow>(TABLE)
      .update({
        status: "CREATED",
        meta_campaign_id: metaCampaignId,
        meta_ad_set_id: metaAdSetId,
        error_message: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id);
    if (error !== null) {
      throw new CampaignCreationRepositoryError(
        `CampaignCreationRepository.markCreated failed: ${error.message}`,
      );
    }
  }

  /** Campaign was created on Meta but ad-set creation failed — `metaCampaignId` is real and stored; `metaAdSetId` stays null. */
  async markPartialFailure(
    id: string,
    metaCampaignId: string,
    errorMessage: string,
  ): Promise<void> {
    const { error } = await this.client
      .from<CampaignCreationRequestRow>(TABLE)
      .update({
        status: "PARTIAL_FAILURE",
        meta_campaign_id: metaCampaignId,
        error_message: errorMessage,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id);
    if (error !== null) {
      throw new CampaignCreationRepositoryError(
        `CampaignCreationRepository.markPartialFailure failed: ${error.message}`,
      );
    }
  }

  /** Nothing was created on Meta at all — safe to retry later. */
  async markFailed(id: string, errorMessage: string): Promise<void> {
    const { error } = await this.client
      .from<CampaignCreationRequestRow>(TABLE)
      .update({
        status: "FAILED",
        error_message: errorMessage,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id);
    if (error !== null) {
      throw new CampaignCreationRepositoryError(
        `CampaignCreationRepository.markFailed failed: ${error.message}`,
      );
    }
  }

  /** DEV-mode tenant — `ModeGuardService` never touched Meta. Safe to retry once the tenant is LIVE. */
  async markSimulated(id: string): Promise<void> {
    const { error } = await this.client
      .from<CampaignCreationRequestRow>(TABLE)
      .update({ status: "SIMULATED", error_message: null, updated_at: new Date().toISOString() })
      .eq("id", id);
    if (error !== null) {
      throw new CampaignCreationRepositoryError(
        `CampaignCreationRepository.markSimulated failed: ${error.message}`,
      );
    }
  }
}
