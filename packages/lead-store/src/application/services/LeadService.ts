import type { BranchId, SalesHumanId } from "@aos/branch-manager";
import type { Result } from "@aos/common";

import type { Assignment } from "../../domain/entities/Assignment.js";
import type { Lead } from "../../domain/entities/Lead.js";
import type { ScoringEvent } from "../../domain/entities/ScoringEvent.js";
import type { LeadStoreError } from "../../domain/errors/LeadStoreError.js";
import type { CreateLead, CreateLeadInput } from "../use-cases/CreateLead.js";
import type { GetHotLeads } from "../use-cases/GetHotLeads.js";
import type { GetLead } from "../use-cases/GetLead.js";
import type { GetLeadsByBranch } from "../use-cases/GetLeadsByBranch.js";
import type { GetLeadsBySales } from "../use-cases/GetLeadsBySales.js";
import type { RecordAssignment, RecordAssignmentInput } from "../use-cases/RecordAssignment.js";
import type { RecordScoreEvent, RecordScoreEventInput } from "../use-cases/RecordScoreEvent.js";
import type { UpdateLeadStatus, UpdateLeadStatusInput } from "../use-cases/UpdateLeadStatus.js";

/** Facade over every lead-lifecycle use case — the composition `LeadStoreFactory` wires as `LeadService`. */
export class LeadService {
  constructor(
    private readonly createLead: CreateLead,
    private readonly updateLeadStatus: UpdateLeadStatus,
    private readonly getLead: GetLead,
    private readonly getLeadsByBranch: GetLeadsByBranch,
    private readonly getHotLeads: GetHotLeads,
    private readonly getLeadsBySales: GetLeadsBySales,
    private readonly recordScoreEvent: RecordScoreEvent,
    private readonly recordAssignment: RecordAssignment,
  ) {}

  create(input: CreateLeadInput): Promise<Result<Lead, LeadStoreError>> {
    return this.createLead.execute(input);
  }

  updateStatus(input: UpdateLeadStatusInput): Promise<Result<Lead, LeadStoreError>> {
    return this.updateLeadStatus.execute(input);
  }

  byId(leadId: string): Promise<Result<Lead, LeadStoreError>> {
    return this.getLead.execute(leadId);
  }

  byBranch(branchId: BranchId): Promise<Result<readonly Lead[], LeadStoreError>> {
    return this.getLeadsByBranch.execute(branchId);
  }

  hotByBranch(branchId: BranchId): Promise<Result<readonly Lead[], LeadStoreError>> {
    return this.getHotLeads.execute(branchId);
  }

  bySales(salesHumanId: SalesHumanId): Promise<Result<readonly Lead[], LeadStoreError>> {
    return this.getLeadsBySales.execute(salesHumanId);
  }

  recordScore(input: RecordScoreEventInput): Promise<Result<ScoringEvent, LeadStoreError>> {
    return this.recordScoreEvent.execute(input);
  }

  assign(input: RecordAssignmentInput): Promise<Result<Assignment, LeadStoreError>> {
    return this.recordAssignment.execute(input);
  }
}
