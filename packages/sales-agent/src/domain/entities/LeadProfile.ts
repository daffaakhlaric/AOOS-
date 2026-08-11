import type { QualificationStatus } from "../value-objects/QualificationStatus.js";

export interface LeadProfileProps {
  readonly budget?: string;
  readonly unit?: string;
  readonly area?: string;
  readonly paymentMethod?: string;
  readonly timeline?: string;
  readonly name?: string;
  readonly qualified: ReadonlySet<QualificationStatus>;
}

/**
 * Extracted, gradually-enriched info about a lead — built up message-by-message by
 * `LeadProfileBuilder` from `QualificationDetector` matches, never all-at-once via a
 * questionnaire (spec persona: "qualify lead gradually"). Immutable: every enrichment produces a
 * NEW `LeadProfile`.
 */
export class LeadProfile {
  private constructor(private readonly props: LeadProfileProps) {}

  static empty(): LeadProfile {
    return new LeadProfile({ qualified: new Set() });
  }

  static create(props: LeadProfileProps): LeadProfile {
    return new LeadProfile({ ...props, qualified: new Set(props.qualified) });
  }

  get budget(): string | undefined {
    return this.props.budget;
  }

  get unit(): string | undefined {
    return this.props.unit;
  }

  get area(): string | undefined {
    return this.props.area;
  }

  get paymentMethod(): string | undefined {
    return this.props.paymentMethod;
  }

  get timeline(): string | undefined {
    return this.props.timeline;
  }

  get name(): string | undefined {
    return this.props.name;
  }

  get qualified(): ReadonlySet<QualificationStatus> {
    return this.props.qualified;
  }

  isQualified(status: QualificationStatus): boolean {
    return this.props.qualified.has(status);
  }

  /** Returns a NEW `LeadProfile` with `patch` merged in and `status` added to `qualified`, if given. */
  withEnrichment(
    patch: Partial<Omit<LeadProfileProps, "qualified">>,
    status?: QualificationStatus,
  ): LeadProfile {
    const nextQualified = new Set(this.props.qualified);
    if (status !== undefined) {
      nextQualified.add(status);
    }
    return new LeadProfile({ ...this.props, ...patch, qualified: nextQualified });
  }
}
