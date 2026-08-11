import type { Result } from "@aos/common";

import type { Assignment } from "../domain/entities/Assignment.js";
import type { SupabaseError } from "../domain/errors/SupabaseError.js";
import type { LeadId } from "../domain/value-objects/LeadId.js";

/** Repository contract for `assignments`. */
export interface IAssignmentRepository {
  insert(assignment: Assignment): Promise<Result<Assignment, SupabaseError>>;
  findByLeadId(leadId: LeadId): Promise<Result<readonly Assignment[], SupabaseError>>;
}
