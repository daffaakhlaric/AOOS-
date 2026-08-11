import { err, ok, type Result } from "@aos/common";
import type { Branch } from "@aos/meta-ads-connector";

import type { IAssetRepository } from "../../contracts/IAssetRepository.js";
import type { Asset } from "../../domain/entities/Asset.js";
import type { AssetError } from "../../domain/errors/AssetError.js";
import { StorageError } from "../../domain/errors/StorageError.js";
import type { AssetId } from "../../domain/value-objects/AssetId.js";
import type { AssetStatus } from "../../domain/value-objects/AssetStatus.js";
import type { AssetType } from "../../domain/value-objects/AssetType.js";
import { AssetMapper, type AssetRow } from "../mappers/AssetMapper.js";

import type { SupabaseClientLike } from "./SupabaseTypes.js";

const TABLE = "assets";

/** Supabase (Postgrest) implementation of `IAssetRepository`, backing the `assets` metadata table. Mirrors `@aos/lead-store`'s `LeadRepository`. */
export class AssetRepository implements IAssetRepository {
  constructor(private readonly client: SupabaseClientLike) {}

  async findById(id: AssetId): Promise<Result<Asset | undefined, AssetError>> {
    const { data, error } = await this.client
      .from<AssetRow>(TABLE)
      .select("*")
      .eq("id", id.toString())
      .maybeSingle();
    if (error !== null) {
      return err(new StorageError(`AssetRepository.findById failed: ${error.message}`));
    }
    if (data === null) {
      return ok(undefined);
    }
    return mapRow(data);
  }

  async insert(asset: Asset): Promise<Result<Asset, AssetError>> {
    const { data, error } = await this.client
      .from<AssetRow>(TABLE)
      .insert(AssetMapper.toRow(asset))
      .select("*")
      .single();
    if (error !== null) {
      return err(new StorageError(`AssetRepository.insert failed: ${error.message}`));
    }
    if (data === null) {
      return err(new StorageError("AssetRepository.insert failed: no row returned"));
    }
    return mapRow(data);
  }

  async update(asset: Asset): Promise<Result<Asset, AssetError>> {
    const { data, error } = await this.client
      .from<AssetRow>(TABLE)
      .update(AssetMapper.toRow(asset))
      .eq("id", asset.id.toString())
      .select("*")
      .single();
    if (error !== null) {
      return err(new StorageError(`AssetRepository.update failed: ${error.message}`));
    }
    if (data === null) {
      return err(new StorageError("AssetRepository.update failed: no row returned"));
    }
    return mapRow(data);
  }

  async findByUnitId(
    unitId: string,
    status?: AssetStatus,
  ): Promise<Result<readonly Asset[], AssetError>> {
    let query = this.client.from<AssetRow>(TABLE).select("*").eq("unit_id", unitId);
    if (status !== undefined) {
      query = query.eq("status", status);
    }
    const { data, error } = await query.order("created_at", { ascending: false });
    if (error !== null) {
      return err(new StorageError(`AssetRepository.findByUnitId failed: ${error.message}`));
    }
    return mapRows(data ?? []);
  }

  async findByBranch(branch: Branch): Promise<Result<readonly Asset[], AssetError>> {
    const { data, error } = await this.client
      .from<AssetRow>(TABLE)
      .select("*")
      .eq("branch", branch)
      .order("created_at", { ascending: false });
    if (error !== null) {
      return err(new StorageError(`AssetRepository.findByBranch failed: ${error.message}`));
    }
    return mapRows(data ?? []);
  }

  async findByType(
    type: AssetType,
    status?: AssetStatus,
  ): Promise<Result<readonly Asset[], AssetError>> {
    let query = this.client.from<AssetRow>(TABLE).select("*").eq("type", type);
    if (status !== undefined) {
      query = query.eq("status", status);
    }
    const { data, error } = await query.order("created_at", { ascending: false });
    if (error !== null) {
      return err(new StorageError(`AssetRepository.findByType failed: ${error.message}`));
    }
    return mapRows(data ?? []);
  }
}

function mapRow(row: AssetRow): Result<Asset, AssetError> {
  const result = AssetMapper.toDomain(row);
  if (!result.ok) {
    return err(new StorageError(`AssetRepository: row mapping failed: ${result.error.message}`));
  }
  return ok(result.value);
}

function mapRows(rows: readonly AssetRow[]): Result<readonly Asset[], AssetError> {
  const assets: Asset[] = [];
  for (const row of rows) {
    const result = mapRow(row);
    if (!result.ok) {
      return result;
    }
    assets.push(result.value);
  }
  return ok(assets);
}
