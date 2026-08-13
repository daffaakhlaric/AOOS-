import type { CreativeBrief } from "@aos/meta-ads-agent";

import type { CreativeFormat } from "../value-objects/CreativeFormat.js";
import { GenerationStatus } from "../value-objects/GenerationStatus.js";
import type { JobId } from "../value-objects/JobId.js";
import type { PackageId } from "../value-objects/PackageId.js";

export interface GenerationJobProps {
  readonly id: JobId;
  readonly brief: CreativeBrief;
  readonly status: GenerationStatus;
  readonly format?: CreativeFormat;
  readonly packageId?: PackageId;
  readonly failureReason?: string;
  readonly startedAt: Date;
  readonly completedAt?: Date;
}

/**
 * Tracks one `KaiAgentService.processCreativeBrief` run end-to-end (spec "Domain — entities/
 * GenerationJob.ts") — what `GetGenerationStatus` reads and `RetryFailedGeneration` re-drives.
 * Immutable; every state transition (`withStatus`, ...) returns a NEW `GenerationJob`, mirroring
 * `@aos/asset-library`'s `Asset.withStatus` convention.
 */
export class GenerationJob {
  private constructor(private readonly props: GenerationJobProps) {}

  static create(props: GenerationJobProps): GenerationJob {
    return new GenerationJob(props);
  }

  get id(): JobId {
    return this.props.id;
  }

  get brief(): CreativeBrief {
    return this.props.brief;
  }

  get status(): GenerationStatus {
    return this.props.status;
  }

  get format(): CreativeFormat | undefined {
    return this.props.format;
  }

  get packageId(): PackageId | undefined {
    return this.props.packageId;
  }

  get failureReason(): string | undefined {
    return this.props.failureReason;
  }

  get startedAt(): Date {
    return this.props.startedAt;
  }

  get completedAt(): Date | undefined {
    return this.props.completedAt;
  }

  withStatus(status: GenerationStatus, at?: Date): GenerationJob {
    return new GenerationJob({ ...this.props, status, completedAt: at ?? this.props.completedAt });
  }

  withFormat(format: CreativeFormat): GenerationJob {
    return new GenerationJob({ ...this.props, format });
  }

  withReady(packageId: PackageId, completedAt: Date): GenerationJob {
    return new GenerationJob({
      ...this.props,
      status: GenerationStatus.READY,
      packageId,
      completedAt,
    });
  }

  withFailure(reason: string, completedAt: Date): GenerationJob {
    return new GenerationJob({
      ...this.props,
      status: GenerationStatus.FAILED,
      failureReason: reason,
      completedAt,
    });
  }
}
