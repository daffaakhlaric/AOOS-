import { err, ok, type Result } from "@aos/common";
import { ValidationError } from "@aos/errors";
import type { Branch } from "@aos/meta-ads-connector";

import type { PhoneNumber } from "../value-objects/PhoneNumber.js";
import type { PhoneNumberId } from "../value-objects/PhoneNumberId.js";
import type { WabaId } from "../value-objects/WabaId.js";

export type WabaAccountStatus = "ACTIVE" | "INACTIVE";

export interface WabaAccountProps {
  readonly id: WabaId;
  readonly phoneNumberId: PhoneNumberId;
  readonly phoneNumber: PhoneNumber;
  readonly branch: Branch;
  readonly displayName: string;
  readonly status: WabaAccountStatus;
  readonly registeredAt: Date;
}

/**
 * One WhatsApp Business Account phone number, one per branch. See `value-objects/Branch.ts` for
 * the `PONDOK_BAMBU` → `Branch.UMUM` resolution: a `WabaAccount` configured from the
 * `WABA_ID_PONDOK_BAMBU` env block resolves its `branch` field to `Branch.UMUM`.
 */
export class WabaAccount {
  private constructor(private readonly props: WabaAccountProps) {}

  static create(props: WabaAccountProps): Result<WabaAccount, ValidationError> {
    if (typeof props.displayName !== "string" || props.displayName.trim().length === 0) {
      return err(new ValidationError("WabaAccount.displayName must be a non-empty string"));
    }
    if (props.status !== "ACTIVE" && props.status !== "INACTIVE") {
      return err(
        new ValidationError(
          `WabaAccount.status must be "ACTIVE" or "INACTIVE", received: ${String(props.status)}`,
        ),
      );
    }
    return ok(new WabaAccount({ ...props }));
  }

  get id(): WabaId {
    return this.props.id;
  }

  get phoneNumberId(): PhoneNumberId {
    return this.props.phoneNumberId;
  }

  get phoneNumber(): PhoneNumber {
    return this.props.phoneNumber;
  }

  get branch(): Branch {
    return this.props.branch;
  }

  get displayName(): string {
    return this.props.displayName;
  }

  get status(): WabaAccountStatus {
    return this.props.status;
  }

  get registeredAt(): Date {
    return this.props.registeredAt;
  }
}
