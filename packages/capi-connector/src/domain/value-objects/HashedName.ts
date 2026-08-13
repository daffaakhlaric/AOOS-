import { err, ok, type Result } from "@aos/common";
import { ValidationError } from "@aos/errors";

const SHA256_HEX_PATTERN = /^[0-9a-f]{64}$/;

/** A SHA256-hashed first name, ready for Meta CAPI's `user_data.fn`. Wraps an already-computed hex digest — hashing itself is `EventHasherService`'s job. */
export class HashedName {
  private constructor(private readonly hash: string) {}

  static create(hash: string): Result<HashedName, ValidationError> {
    if (typeof hash !== "string" || !SHA256_HEX_PATTERN.test(hash)) {
      return err(
        new ValidationError(
          `HashedName must be a 64-character lowercase hex sha256 digest, received: ${JSON.stringify(hash)}`,
        ),
      );
    }
    return ok(new HashedName(hash));
  }

  get value(): string {
    return this.hash;
  }
}
