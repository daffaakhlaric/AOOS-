import type { BranchId, SalesHumanId } from "@aos/branch-manager";
import { err, ok, type Result } from "@aos/common";

import type { ILeadRepository } from "../../contracts/ILeadRepository.js";
import type { Lead } from "../../domain/entities/Lead.js";
import { SupabaseError } from "../../domain/errors/SupabaseError.js";
import type { LeadId } from "../../domain/value-objects/LeadId.js";
import { LeadMapper, type LeadRow } from "../mappers/LeadMapper.js";

import type { SupabaseClientLike } from "./SupabaseTypes.js";

const TABLE = "leads";

/** Supabase implementation of `ILeadRepository`. */
export class LeadRepository implements ILeadRepository {
  constructor(private readonly client: SupabaseClientLike) {}

  async findById(id: LeadId): Promise<Result<Lead | undefined, SupabaseError>> {
    const { data, error } = await this.client
      .from<LeadRow>(TABLE)
      .select("*")
      .eq("id", id.toString())
      .maybeSingle();
    if (error !== null) {
      return err(new SupabaseError(`LeadRepository.findById failed: ${error.message}`));
    }
    if (data === null) {
      return ok(undefined);
    }
    return mapRow(data);
  }

  async findByPhoneAndBranch(
    leadPhone: string,
    branchId: BranchId,
  ): Promise<Result<Lead | undefined, SupabaseError>> {
    const { data, error } = await this.client
      .from<LeadRow>(TABLE)
      .select("*")
      .eq("lead_phone", leadPhone)
      .eq("branch_id", branchId)
      .maybeSingle();
    if (error !== null) {
      return err(new SupabaseError(`LeadRepository.findByPhoneAndBranch failed: ${error.message}`));
    }
    if (data === null) {
      return ok(undefined);
    }
    return mapRow(data);
  }

  async insert(lead: Lead): Promise<Result<Lead, SupabaseError>> {
    const { data, error } = await this.client
      .from<LeadRow>(TABLE)
      .insert(LeadMapper.toRow(lead))
      .select("*")
      .single();
    if (error !== null) {
      return err(new SupabaseError(`LeadRepository.insert failed: ${error.message}`));
    }
    if (data === null) {
      return err(new SupabaseError("LeadRepository.insert failed: no row returned"));
    }
    return mapRow(data);
  }

  async update(lead: Lead): Promise<Result<Lead, SupabaseError>> {
    const { data, error } = await this.client
      .from<LeadRow>(TABLE)
      .update(LeadMapper.toRow(lead))
      .eq("id", lead.id.toString())
      .select("*")
      .single();
    if (error !== null) {
      return err(new SupabaseError(`LeadRepository.update failed: ${error.message}`));
    }
    if (data === null) {
      return err(new SupabaseError("LeadRepository.update failed: no row returned"));
    }
    return mapRow(data);
  }

  async findByBranch(branchId: BranchId): Promise<Result<readonly Lead[], SupabaseError>> {
    const { data, error } = await this.client
      .from<LeadRow>(TABLE)
      .select("*")
      .eq("branch_id", branchId)
      .order("created_at", { ascending: false });
    if (error !== null) {
      return err(new SupabaseError(`LeadRepository.findByBranch failed: ${error.message}`));
    }
    return mapRows(data ?? []);
  }

  async findHotByBranch(branchId: BranchId): Promise<Result<readonly Lead[], SupabaseError>> {
    const { data, error } = await this.client
      .from<LeadRow>(TABLE)
      .select("*")
      .eq("branch_id", branchId)
      .eq("status", "HOT");
    if (error !== null) {
      return err(new SupabaseError(`LeadRepository.findHotByBranch failed: ${error.message}`));
    }
    return mapRows(data ?? []);
  }

  async findBySales(salesHumanId: SalesHumanId): Promise<Result<readonly Lead[], SupabaseError>> {
    const { data, error } = await this.client
      .from<LeadRow>(TABLE)
      .select("*")
      .eq("assigned_sales_id", salesHumanId.toString());
    if (error !== null) {
      return err(new SupabaseError(`LeadRepository.findBySales failed: ${error.message}`));
    }
    return mapRows(data ?? []);
  }
}

function mapRow(row: LeadRow): Result<Lead, SupabaseError> {
  const result = LeadMapper.toDomain(row);
  if (!result.ok) {
    return err(new SupabaseError(`LeadRepository: row mapping failed: ${result.error.message}`));
  }
  return ok(result.value);
}

function mapRows(rows: readonly LeadRow[]): Result<readonly Lead[], SupabaseError> {
  const leads: Lead[] = [];
  for (const row of rows) {
    const result = mapRow(row);
    if (!result.ok) {
      return result;
    }
    leads.push(result.value);
  }
  return ok(leads);
}
