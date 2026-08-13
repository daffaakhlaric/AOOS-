import type { BranchStatus } from "@aos/branch-manager";

/** JSON-serializable projection of a `BranchStatus` (`GetBranchStatus`'s output) — mirrors `LeadResponseDto`'s flattening convention. */
export interface SalesHumanResponseDto {
  readonly id: string;
  readonly name: string;
  readonly waNumber: string;
  readonly status: string;
  readonly maxLeadsPerDay: number;
  readonly activeLeadCount: number;
  readonly todayLeadCount: number;
  readonly isAvailable: boolean;
}

export interface BranchResponseDto {
  readonly id: string;
  readonly name: string;
  readonly displayName: string;
  readonly wabaPhoneNumberId: string;
  readonly wabaPhoneNumber: string;
  readonly assignmentMode: string;
  readonly maxLeadsPerSalesPerDay: number;
  readonly active: boolean;
  readonly team: readonly SalesHumanResponseDto[];
  readonly availableCount: number;
  readonly queueSize: number;
  readonly todayAssignedCount: number;
}

export function toBranchResponseDto(status: BranchStatus): BranchResponseDto {
  return {
    id: status.branch.id.toString(),
    name: status.branch.name,
    displayName: status.branch.displayName,
    wabaPhoneNumberId: status.branch.wabaPhoneNumberId.toString(),
    wabaPhoneNumber: status.branch.wabaPhoneNumber,
    assignmentMode: status.branch.assignmentMode,
    maxLeadsPerSalesPerDay: status.branch.maxLeadsPerSalesPerDay.toNumber(),
    active: status.branch.active,
    team: status.team.map((s) => ({
      id: s.id.toString(),
      name: s.name,
      waNumber: s.waNumber,
      status: s.status,
      maxLeadsPerDay: s.maxLeadsPerDay.toNumber(),
      activeLeadCount: s.activeLeadCount.toNumber(),
      todayLeadCount: s.todayLeadCount.toNumber(),
      isAvailable: s.isAvailable,
    })),
    availableCount: status.availableCount,
    queueSize: status.queueSize,
    todayAssignedCount: status.todayAssignedCount,
  };
}
