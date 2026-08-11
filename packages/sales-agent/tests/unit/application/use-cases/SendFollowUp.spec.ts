import { BranchId } from "@aos/branch-manager";
import { describe, expect, it } from "vitest";

import { SendFollowUp } from "../../../../src/application/use-cases/SendFollowUp.js";
import { FollowUpDay } from "../../../../src/domain/value-objects/FollowUpDay.js";
import { unwrap, unwrapErr } from "../../../helpers/result.js";

describe("SendFollowUp", () => {
  it("prepares (never sends) a D3 follow-up OutgoingMessage", () => {
    const useCase = new SendFollowUp();
    const message = unwrap(
      useCase.execute({
        leadPhone: "+6281200000001",
        branchId: BranchId.CINERE,
        day: FollowUpDay.D3,
        seed: 0,
      }),
    );
    expect(message.to.toString()).toBe("+6281200000001");
    expect(message.body.length).toBeGreaterThan(0);
  });

  it("returns an error for an invalid phone number", () => {
    const useCase = new SendFollowUp();
    const result = useCase.execute({
      leadPhone: "invalid",
      branchId: BranchId.CINERE,
      day: FollowUpDay.D7,
      seed: 0,
    });
    expect(unwrapErr(result).message).toContain("PhoneNumber");
  });
});
