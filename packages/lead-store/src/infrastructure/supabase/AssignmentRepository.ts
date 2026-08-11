import { AssignmentMode, BranchId, SalesHumanId } from "@aos/branch-manager";
import { err, ok, type Result } from "@aos/common";

import type { IAssignmentRepository } from "../../contracts/IAssignmentRepository.js";
import { Assignment, type AssignmentStatus } from "../../domain/entities/Assignment.js";
import { SupabaseError } from "../../domain/errors/SupabaseError.js";
import { AssignmentId } from "../../domain/value-objects/AssignmentId.js";
import type { LeadId } from "../../domain/value-objects/LeadId.js";
import { LeadId as LeadIdVo } from "../../domain/value-objects/LeadId.js";

import type { SupabaseClientLike } from "./SupabaseTypes.js";

const TABLE = "assignments";

/** Exact shape of the `assignments` table (spec `001_initial_schema.sql`). */
export interface AssignmentRow {
  readonly id: string;
  readonly lead_id: string;
  readonly branch_id: string;
  readonly sales_human_id: string;
  readonly assignment_mode: string;
  readonly assigned_at: string;
  readonly released_at: string | null;
  readonly status: string;
}

/** Supabase implementation of `IAssignmentRepository`. */
export class AssignmentRepository implements IAssignmentRepository {
  constructor(private readonly client: SupabaseClientLike) {}

  async insert(assignment: Assignment): Promise<Result<Assignment, SupabaseError>> {
    const { data, error } = await this.client
      .from<AssignmentRow>(TABLE)
      .insert(toRow(assignment))
      .select("*")
      .single();
    if (error !== null) {
      return err(new SupabaseError(`AssignmentRepository.insert failed: ${error.message}`));
    }
    if (data === null) {
      return err(new SupabaseError("AssignmentRepository.insert failed: no row returned"));
    }
    return mapRow(data);
  }

  async findByLeadId(leadId: LeadId): Promise<Result<readonly Assignment[], SupabaseError>> {
    const { data, error } = await this.client
      .from<AssignmentRow>(TABLE)
      .select("*")
      .eq("lead_id", leadId.toString())
      .order("assigned_at", { ascending: true });
    if (error !== null) {
      return err(new SupabaseError(`AssignmentRepository.findByLeadId failed: ${error.message}`));
    }
    const assignments: Assignment[] = [];
    for (const row of data ?? []) {
      const mapped = mapRow(row);
      if (!mapped.ok) {
        return mapped;
      }
      assignments.push(mapped.value);
    }
    return ok(assignments);
  }
}

function toRow(assignment: Assignment): AssignmentRow {
  return {
    id: assignment.id.toString(),
    lead_id: assignment.leadId.toString(),
    branch_id: assignment.branchId,
    sales_human_id: assignment.salesHumanId.toString(),
    assignment_mode: assignment.assignmentMode,
    assigned_at: assignment.assignedAt.toISOString(),
    released_at: assignment.releasedAt?.toISOString() ?? null,
    status: assignment.status,
  };
}

function mapRow(row: AssignmentRow): Result<Assignment, SupabaseError> {
  const idResult = AssignmentId.create(row.id);
  if (!idResult.ok) {
    return err(
      new SupabaseError(`AssignmentRepository: row mapping failed: ${idResult.error.message}`),
    );
  }
  const leadIdResult = LeadIdVo.create(row.lead_id);
  if (!leadIdResult.ok) {
    return err(
      new SupabaseError(`AssignmentRepository: row mapping failed: ${leadIdResult.error.message}`),
    );
  }
  const salesIdResult = SalesHumanId.create(row.sales_human_id);
  if (!salesIdResult.ok) {
    return err(
      new SupabaseError(`AssignmentRepository: row mapping failed: ${salesIdResult.error.message}`),
    );
  }
  if (!Object.values(BranchId).includes(row.branch_id as BranchId)) {
    return err(new SupabaseError(`AssignmentRepository: invalid branch_id: "${row.branch_id}"`));
  }
  if (!Object.values(AssignmentMode).includes(row.assignment_mode as AssignmentMode)) {
    return err(
      new SupabaseError(`AssignmentRepository: invalid assignment_mode: "${row.assignment_mode}"`),
    );
  }
  if (row.status !== "ACTIVE" && row.status !== "RELEASED") {
    return err(new SupabaseError(`AssignmentRepository: invalid status: "${row.status}"`));
  }
  const assignmentResult = Assignment.create({
    id: idResult.value,
    leadId: leadIdResult.value,
    branchId: row.branch_id as BranchId,
    salesHumanId: salesIdResult.value,
    assignmentMode: row.assignment_mode as AssignmentMode,
    assignedAt: new Date(row.assigned_at),
    releasedAt: row.released_at !== null ? new Date(row.released_at) : undefined,
    status: row.status as AssignmentStatus,
  });
  if (!assignmentResult.ok) {
    return err(
      new SupabaseError(
        `AssignmentRepository: row mapping failed: ${assignmentResult.error.message}`,
      ),
    );
  }
  return ok(assignmentResult.value);
}
