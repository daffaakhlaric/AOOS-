import { err, ok, type Result } from "@aos/common";
import { ValidationError } from "@aos/errors";

const SHA256_HEX_PATTERN = /^[0-9a-f]{64}$/;

/** A SHA256-hashed phone number, ready for Meta CAPI's `user_data.ph`. Wraps an already-computed hex digest — hashing itself is `EventHasherService`'s job. */
export class HashedPhone {
  private constructor(private readonly hash: string) {}

  static create(hash: string): Result<HashedPhone, ValidationError> {
    if (typeof hash !== "string" || !SHA256_HEX_PATTERN.test(hash)) {
      return err(
        new ValidationError(
          `HashedPhone must be a 64-character lowercase hex sha256 digest, received: ${JSON.stringify(hash)}`,
        ),
      );
    }
    return ok(new HashedPhone(hash));
  }

  get value(): string {
    return this.hash;
  }
}
