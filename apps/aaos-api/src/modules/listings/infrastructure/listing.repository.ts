import type { SupabaseClientLike } from "@aos/lead-store";

const TABLE = "listings";

/** A single stored photo entry inside `listings.photos` (JSONB array) — COLUMN-FOR-COLUMN with `PhotoResponseDto`. */
export interface ListingPhotoRow {
  readonly storagePath?: string;
  readonly id: string;
  readonly url: string;
  readonly label?: string;
  readonly order: number;
  readonly isMain: boolean;
}

/** A single stored document entry inside `listings.documents` (JSONB array, `025_listing_documents.sql`)
 * — COLUMN-FOR-COLUMN with `DocumentResponseDto` PLUS one internal-only field: `storagePath` (the
 * real GCS object path returned by `IAssetStorage.upload`'s `UploadedFile.path`, distinct from
 * `url`/`publicUrl`). Kept out of `DocumentResponseDto` (never sent over the wire) — it exists
 * solely so `ListingsService.deleteDocument` can issue a real GCS object deletion without
 * re-deriving the storage path from the public URL string. */
export interface ListingDocumentRow {
  readonly id: string;
  readonly filename: string;
  readonly url: string;
  readonly mimeType: string;
  readonly sizeBytes: number;
  readonly label?: string;
  readonly uploadedAt: string;
  readonly storagePath: string;
}

/** Raw `listings` row shape (snake_case) — COLUMN-FOR-COLUMN with `supabase/migrations/008_listings.sql`. */
export interface ListingRow {
  readonly id: string;
  readonly tenant_id: string;
  readonly title: string;
  readonly property_type: string;
  readonly listing_status: string;
  readonly price: number;
  readonly branch_id: string | null;
  readonly wa_number: string | null;
  readonly meta_page_id?: string | null;
  readonly meta_ad_account_id?: string | null;
  readonly land_area: number | null;
  readonly build_area: number | null;
  readonly bedrooms: number | null;
  readonly bathrooms: number | null;
  readonly garage: number | null;
  readonly floors: number | null;
  readonly certificate: string | null;
  readonly condition: string | null;
  readonly electricity: number | null;
  readonly facing: string | null;
  readonly address: string | null;
  readonly city: string | null;
  readonly province: string | null;
  /** AAOS-GEO-TARGETING-AND-REGION-PICKER Part B (`033_listings_kecamatan.sql`) — additive,
   * nullable. Populated by the Listing form's real cascading picker's chosen kecamatan `nama`
   * display string; `undefined`/`null` for every listing created before this column existed. */
  readonly kecamatan: string | null;
  readonly postal_code: string | null;
  readonly description: string | null;
  readonly highlights: readonly string[];
  readonly photos: readonly ListingPhotoRow[];
  readonly main_photo_url: string | null;
  readonly documents: readonly ListingDocumentRow[];
  readonly in_knowledge_base: boolean;
  readonly created_at: string;
  readonly updated_at: string;
}

export type ListingInsert = Omit<ListingRow, "id" | "created_at" | "updated_at">;
export type ListingUpdate = Partial<Omit<ListingRow, "id" | "tenant_id" | "created_at">>;

export class ListingRepositoryError extends Error {}

/** Same `.delete()` workaround as `modules/settings/infrastructure/waba-config.repository.ts` — see that file's docstring for why `SupabaseClientLike` deliberately doesn't declare `.delete()`. */
interface DeletableSupabaseClient {
  from(table: string): {
    delete(): {
      eq(column: string, value: unknown): PromiseLike<{ error: { message: string } | null }>;
    };
  };
}

/**
 * Supabase-backed persistence for `listings` (AAOS-MULTI-TENANT-SUPERADMIN-PROPERTY Phase 2 —
 * Listing Manager). Every read/write is explicitly tenant-scoped (never relies on the column's
 * `DEFAULT 'dss-motor'`), same discipline `WabaConfigRepository`/`TenantRepository` already
 * establish for this app's genuinely-new-from-Phase-1-onward modules.
 */
export class ListingRepository {
  constructor(private readonly client: SupabaseClientLike) {}

  /** Synced campaign evidence, scoped before returning any linkage. */
  async advertisingCampaigns(
    tenantId: string,
  ): Promise<
    readonly {
      listing_id: string | null;
      meta_campaign_id: string;
      name: string;
      status: string;
      synced_at: string;
    }[]
  > {
    const { data, error } = await this.client
      .from<{
        listing_id: string | null;
        meta_campaign_id: string;
        name: string;
        status: string;
        synced_at: string;
      }>("meta_campaigns")
      .select("listing_id,meta_campaign_id,name,status,synced_at")
      .eq("tenant_id", tenantId);
    if (error !== null) throw new ListingRepositoryError("Campaign linkage unavailable");
    return data ?? [];
  }

  async insert(values: ListingInsert): Promise<ListingRow> {
    const { data, error } = await this.client
      .from<ListingRow>(TABLE)
      .insert(values)
      .select("*")
      .single();
    if (error !== null || data === null) {
      throw new ListingRepositoryError(
        `ListingRepository.insert failed: ${error?.message ?? "no row returned"}`,
      );
    }
    return data;
  }

  async findById(id: string): Promise<ListingRow | undefined> {
    const { data, error } = await this.client
      .from<ListingRow>(TABLE)
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (error !== null) {
      throw new ListingRepositoryError(`ListingRepository.findById failed: ${error.message}`);
    }
    return data ?? undefined;
  }

  async listByTenant(tenantId: string): Promise<readonly ListingRow[]> {
    const { data, error } = await this.client
      .from<ListingRow>(TABLE)
      .select("*")
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: false });
    if (error !== null) {
      throw new ListingRepositoryError(`ListingRepository.listByTenant failed: ${error.message}`);
    }
    return data ?? [];
  }

  async updateById(id: string, values: ListingUpdate): Promise<ListingRow> {
    const { data, error } = await this.client
      .from<ListingRow>(TABLE)
      .update(values)
      .eq("id", id)
      .select("*")
      .single();
    if (error !== null || data === null) {
      throw new ListingRepositoryError(
        `ListingRepository.updateById failed: ${error?.message ?? "no row returned"}`,
      );
    }
    return data;
  }

  async deleteById(id: string): Promise<void> {
    const client = this.client as unknown as DeletableSupabaseClient;
    const { error } = await client.from(TABLE).delete().eq("id", id);
    if (error !== null) {
      throw new ListingRepositoryError(`ListingRepository.deleteById failed: ${error.message}`);
    }
  }
}
