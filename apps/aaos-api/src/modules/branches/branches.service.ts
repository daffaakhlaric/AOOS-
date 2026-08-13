import type { BranchManager } from "@aos/branch-manager";
import {
  ALL_BRANCH_IDS,
  BranchConfigBuilder,
  BranchId,
  parseAssignmentMode,
  parseSalesStatus,
  SalesHumanId,
} from "@aos/branch-manager";
import { ValidationError } from "@aos/errors";
import { Inject, Injectable } from "@nestjs/common";

import { BRANCH_MANAGER } from "../../di-tokens.js";

import { toBranchResponseDto, type BranchResponseDto } from "./dto/branch-response.dto.js";
import type { UpdateBranchBodyDto } from "./dto/update-branch.dto.js";

/**
 * Wires `@aos/branch-manager`'s use cases, translating between this app's HTTP DTOs and the
 * package's domain types. Consistent error-translation pattern with `LeadsService`: on
 * `Result.err(...)`, re-throws the raw `@aos/branch-manager` error instance — never a Nest
 * `HttpException` — so `AaosExceptionFilter` decides the resulting HTTP status.
 *
 * See `dto/update-branch.dto.ts`'s doc (AAOS-W4A coordinator note #5) for why `updateBranch`
 * dispatches to several distinct `@aos/branch-manager` use cases instead of calling one generic
 * "update" — that use case does not exist in the package's real API.
 */
@Injectable()
export class BranchesService {
  constructor(@Inject(BRANCH_MANAGER) private readonly branchManager: BranchManager) {}

  listBranches(): readonly BranchResponseDto[] {
    return ALL_BRANCH_IDS.map((id) => {
      const result = this.branchManager.getBranchStatus.execute({ branchId: id });
      if (!result.ok) {
        throw result.error;
      }
      return toBranchResponseDto(result.value);
    });
  }

  private parseBranchId(raw: string): BranchId {
    const normalized = raw.trim().toUpperCase();
    const found = ALL_BRANCH_IDS.find((id) => id === normalized);
    if (found === undefined) {
      throw new ValidationError(
        `Unknown branchId "${raw}" — expected one of: ${ALL_BRANCH_IDS.join(", ")}`,
      );
    }
    return found;
  }

  async updateBranch(
    rawBranchId: string,
    body: UpdateBranchBodyDto,
    tenantId: string,
    correlationId: string,
  ): Promise<BranchResponseDto> {
    const branchId = this.parseBranchId(rawBranchId);

    if (body.assignmentMode !== undefined || body.maxLeadsPerSalesPerDay !== undefined) {
      this.updateBranchConfig(branchId, body);
    }

    for (const removeId of body.removeSalesHumanIds ?? []) {
      const idResult = SalesHumanId.create(removeId);
      if (!idResult.ok) {
        throw idResult.error;
      }
      const result = this.branchManager.removeSalesHuman.execute({ salesHumanId: idResult.value });
      if (!result.ok) {
        throw result.error;
      }
    }

    for (const entry of body.addSales ?? []) {
      const statusResult = entry.status !== undefined ? parseSalesStatus(entry.status) : undefined;
      if (statusResult !== undefined && !statusResult.ok) {
        throw statusResult.error;
      }
      const result = this.branchManager.addSalesHuman.execute({
        name: entry.name,
        waNumber: entry.waNumber,
        branchId,
        ...(statusResult !== undefined ? { status: statusResult.value } : {}),
        ...(entry.maxLeadsPerDay !== undefined ? { maxLeadsPerDay: entry.maxLeadsPerDay } : {}),
      });
      if (!result.ok) {
        throw result.error;
      }
    }

    for (const entry of body.updateSalesStatus ?? []) {
      const idResult = SalesHumanId.create(entry.salesHumanId);
      if (!idResult.ok) {
        throw idResult.error;
      }
      const statusResult = parseSalesStatus(entry.status);
      if (!statusResult.ok) {
        throw statusResult.error;
      }
      const result = await this.branchManager.updateSalesStatus.execute({
        salesHumanId: idResult.value,
        status: statusResult.value,
        tenantId,
        correlationId,
      });
      if (!result.ok) {
        throw result.error;
      }
    }

    const statusResult = this.branchManager.getBranchStatus.execute({ branchId });
    if (!statusResult.ok) {
      throw statusResult.error;
    }
    return toBranchResponseDto(statusResult.value);
  }

  private updateBranchConfig(
    branchId: BranchId,
    body: Pick<UpdateBranchBodyDto, "assignmentMode" | "maxLeadsPerSalesPerDay">,
  ): void {
    const existingResult = this.branchManager.branchRegistry.getByBranchId(branchId);
    if (!existingResult.ok) {
      throw existingResult.error;
    }
    const existing = existingResult.value;

    const modeResult =
      body.assignmentMode !== undefined ? parseAssignmentMode(body.assignmentMode) : undefined;
    if (modeResult !== undefined && !modeResult.ok) {
      throw modeResult.error;
    }

    const builder = new BranchConfigBuilder()
      .withId(existing.id)
      .withName(existing.name)
      .withDisplayName(existing.displayName)
      .withWabaPhoneNumberId(existing.wabaPhoneNumberId.toString())
      .withWabaPhoneNumber(existing.wabaPhoneNumber)
      .withAssignmentMode(modeResult !== undefined ? modeResult.value : existing.assignmentMode)
      .withMaxLeadsPerSalesPerDay(
        body.maxLeadsPerSalesPerDay ?? existing.maxLeadsPerSalesPerDay.toNumber(),
      )
      .withActive(existing.active);
    if (existing.managerWaNumber !== undefined) {
      builder.withManagerWaNumber(existing.managerWaNumber);
    }

    const built = builder.build();
    if (!built.ok) {
      throw built.error;
    }
    const updateResult = this.branchManager.branchRegistry.update(built.value);
    if (!updateResult.ok) {
      throw updateResult.error;
    }
  }
}
