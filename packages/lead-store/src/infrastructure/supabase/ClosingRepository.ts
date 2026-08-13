import { err, ok, type Result } from "@aos/common";

import type { ClosingFilter, IClosingRepository } from "../../contracts/IClosingRepository.js";
import type { Closing } from "../../domain/entities/Closing.js";
import { SupabaseError } from "../../domain/errors/SupabaseError.js";
import { ClosingMapper, type ClosingRow } from "../mappers/ClosingMapper.js";

import type { SupabaseClientLike } from "./SupabaseTypes.js";

const TABLE = "closings";

/** Supabase implementation of `IClosingRepository`. */
export class ClosingRepository implements IClosingRepository {
  constructor(private readonly client: SupabaseClientLike) {}

  async insert(closing: Closing): Promise<Result<Closing, SupabaseError>> {
    const { data, error } = await this.client
      .from<ClosingRow>(TABLE)
      .insert(ClosingMapper.toRow(closing))
      .select("*")
      .single();
    if (error !== null) {
      return err(new SupabaseError(`ClosingRepository.insert failed: ${error.message}`));
    }
    if (data === null) {
      return err(new SupabaseError("ClosingRepository.insert failed: no row returned"));
    }
    return mapRow(data);
  }

  async findByFilter(filter: ClosingFilter): Promise<Result<readonly Closing[], SupabaseError>> {
    let query = this.client
      .from<ClosingRow>(TABLE)
      .select("*")
      .gte("created_at", filter.fromDate.toISOString())
      .lte("created_at", filter.toDate.toISOString());
    if (filter.campaignId !== undefined) {
      query = query.eq("campaign_id", filter.campaignId);
    }
    if (filter.adId !== undefined) {
      query = query.eq("ad_id", filter.adId);
    }
    if (filter.branchId !== undefined) {
      query = query.eq("branch_id", filter.branchId);
    }
    if (filter.salesHumanId !== undefined) {
      query = query.eq("sales_human_id", filter.salesHumanId);
    }
    const { data, error } = await query;
    if (error !== null) {
      return err(new SupabaseError(`ClosingRepository.findByFilter failed: ${error.message}`));
    }
    const closings: Closing[] = [];
    for (const row of data ?? []) {
      const mapped = mapRow(row);
      if (!mapped.ok) {
        return mapped;
      }
      closings.push(mapped.value);
    }
    return ok(closings);
  }
}

function mapRow(row: ClosingRow): Result<Closing, SupabaseError> {
  const result = ClosingMapper.toDomain(row);
  if (!result.ok) {
    return err(new SupabaseError(`ClosingRepository: row mapping failed: ${result.error.message}`));
  }
  return ok(result.value);
}
