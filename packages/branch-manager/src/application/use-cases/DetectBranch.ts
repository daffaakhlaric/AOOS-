import { ok, type Result } from "@aos/common";

import type { IBranchRegistry } from "../../contracts/IBranchRegistry.js";
import type { BranchNotFoundError } from "../../domain/errors/index.js";
import type { BranchId } from "../../domain/value-objects/BranchId.js";

export interface DetectBranchInput {
  readonly phoneNumberId: string;
}

/**
 * Key use case: incoming WA message → which branch? Answer comes from `phone_number_id` in the
 * webhook payload. Used by `@aos/whatsapp-connector`'s webhook (route to the correct Clara
 * instance), `@aos/sales-agent` (know which branch a conversation belongs to), and
 * `@aos/lead-store` (tag a lead with the correct branch).
 */
export class DetectBranch {
  constructor(private readonly branchRegistry: IBranchRegistry) {}

  execute(input: DetectBranchInput): Result<BranchId, BranchNotFoundError> {
    const branchResult = this.branchRegistry.getByPhoneNumberId(input.phoneNumberId);
    if (!branchResult.ok) {
      return branchResult;
    }
    return ok(branchResult.value.id);
  }
}
