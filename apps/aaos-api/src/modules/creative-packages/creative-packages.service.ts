import { NotFoundError, ValidationError } from "@aos/errors";
import { Inject, Injectable } from "@nestjs/common";

import { CREATIVE_PACKAGE_STORE } from "../../di-tokens.js";

import { CreativePackageStore } from "./creative-package.store.js";
import {
  toCreativePackageResponseDto,
  type CreativePackageResponseDto,
} from "./dto/creative-package-response.dto.js";
import type { ApprovePackageBodyDto, RejectPackageBodyDto } from "./dto/review-package.dto.js";

/**
 * Reads/reviews `CreativePackageStore` entries. See that store's class doc + AAOS-W4A coordinator
 * note #3 for why this is a process-local in-memory MVP store rather than durable persistence.
 * Consistent error-translation pattern with `LeadsService`: throws the raw `@aos/errors` instance
 * on failure, never a Nest `HttpException` — `AaosExceptionFilter` decides the HTTP status.
 */
@Injectable()
export class CreativePackagesService {
  constructor(@Inject(CREATIVE_PACKAGE_STORE) private readonly store: CreativePackageStore) {}

  listPending(): readonly CreativePackageResponseDto[] {
    return this.store.list().map(toCreativePackageResponseDto);
  }

  approve(id: string, body: ApprovePackageBodyDto, now: Date): CreativePackageResponseDto {
    const existing = this.store.findById(id);
    if (existing === undefined) {
      throw new NotFoundError(`No creative package found with id "${id}"`);
    }
    const selected = body.selectedCopyVariantId ?? existing.copyVariants[0]?.id;
    if (
      selected !== undefined &&
      !existing.copyVariants.some((variant) => variant.id === selected)
    ) {
      throw new ValidationError(
        `selectedCopyVariantId "${selected}" is not a copy variant of package "${id}"`,
      );
    }
    const updated = this.store.review(id, "APPROVED", now.toISOString(), selected);
    /* v8 ignore next 3 -- unreachable: `existing` was already confirmed present above, and this
       store is single-threaded/in-process, so `review` cannot race to `undefined` between the two
       calls. */
    if (updated === undefined) {
      throw new NotFoundError(`No creative package found with id "${id}"`);
    }
    return toCreativePackageResponseDto(updated);
  }

  reject(id: string, _body: RejectPackageBodyDto, now: Date): CreativePackageResponseDto {
    const existing = this.store.findById(id);
    if (existing === undefined) {
      throw new NotFoundError(`No creative package found with id "${id}"`);
    }
    const updated = this.store.review(id, "REJECTED", now.toISOString());
    /* v8 ignore next 3 -- unreachable, see `approve`'s identical note. */
    if (updated === undefined) {
      throw new NotFoundError(`No creative package found with id "${id}"`);
    }
    return toCreativePackageResponseDto(updated);
  }
}
