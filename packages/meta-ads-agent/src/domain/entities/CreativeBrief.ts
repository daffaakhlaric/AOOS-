import { err, ok, type Result } from "@aos/common";
import { ValidationError } from "@aos/errors";
import { Branch } from "@aos/meta-ads-connector";

import type { CreativeFormat, CreativeUrgency } from "../../types/AgentTypes.js";
import { AdAngle } from "../value-objects/AdAngle.js";
import type { CreativeBriefId } from "../value-objects/CreativeBriefId.js";
import { TargetPersona } from "../value-objects/TargetPersona.js";

/** S2 price context, derived from real scraped inventory — AAOS-W1D-S1S2 (S2). See `CreativeBriefBuilder.CreativeBriefPriceContext` (same shape, re-declared here to keep this entity free of an `@aos/mobix-web-scraper` dependency). */
export interface CreativeBriefPriceContext {
  readonly unitPrice: number;
  readonly estimatedDp: number;
  readonly estimatedMonthly: number;
  readonly year: number;
  readonly kilometer: number;
}

export interface CreativeBriefProps {
  readonly id: CreativeBriefId;
  readonly adId: string;
  readonly unit: string;
  readonly branch: Branch;
  readonly angle: AdAngle;
  readonly targetPersona: TargetPersona;
  readonly primaryMessage: string;
  readonly tone: string;
  readonly avoid: ReadonlyArray<string>;
  readonly formats: ReadonlyArray<CreativeFormat>;
  readonly referenceAdId?: string;
  readonly reason: string;
  readonly urgency: CreativeUrgency;
  readonly estimatedImpactIfRefreshed: string;
  readonly createdAt: Date;
  /** AAOS-W1D-S1S2 (S2) — real price/DP/monthly-installment context from `AgentMemory.inventoryByBranch`, when a matching in-stock unit was found. `undefined` for W1D-base callers and when no matching unit is in stock. */
  readonly priceContext?: CreativeBriefPriceContext;
  /** AAOS-W1D-S1S2 (S2) — the relevant `ScrapedPromo.title`, when `AgentMemory.activePromos` has one applicable to this brief's unit. */
  readonly activePromo?: string;
  /** AAOS-W1D-S1S2 (S2) — `BusinessKnowledgeBase.ANGLE_USP_MAP[angle]`, carried onto the brief for Kai's convenience. */
  readonly uspMessages?: ReadonlyArray<string>;
  /**
   * AAOS-W1D-S3 — DSS Motor's real strategy: every CTWA brief tells Kai which Meta CTA button the
   * creative should drive (`SEND_WHATSAPP_MESSAGE`), so the ad routes straight into WhatsApp with
   * Jessy. Optional/additive (coordinator note correction #7) — `undefined` for briefs built
   * before this supplement or by a caller that doesn't populate it.
   */
  readonly callToAction?: string;
  /** AAOS-W1D-S3 — the CTWA destination type (`WHATSAPP`), mirroring `callToAction` above. */
  readonly destinationType?: string;
  /**
   * AAOS-W1D-S3 — the branch's WhatsApp number the lead lands in, sourced from
   * `MetaAdsAgentConfig.ctwaPhoneNumbers` (coordinator note correction #6 — never
   * `process.env` read inside this package). `undefined` when the config has no number for
   * `branch`.
   */
  readonly wabaPhoneNumber?: string;
}

/** Tamara's brief for Kai (future `@aos/creative-agent`) when a REFRESH verdict fires. */
export class CreativeBrief {
  private constructor(private readonly props: CreativeBriefProps) {}

  static create(props: CreativeBriefProps): Result<CreativeBrief, ValidationError> {
    if (typeof props.adId !== "string" || props.adId.trim().length === 0) {
      return err(new ValidationError("CreativeBrief.adId must be a non-empty string"));
    }
    if (typeof props.unit !== "string" || props.unit.trim().length === 0) {
      return err(new ValidationError("CreativeBrief.unit must be a non-empty string"));
    }
    if (!Object.values(Branch).includes(props.branch)) {
      return err(
        new ValidationError(
          `CreativeBrief.branch must be a valid Branch, received: ${String(props.branch)}`,
        ),
      );
    }
    if (!Object.values(AdAngle).includes(props.angle)) {
      return err(
        new ValidationError(
          `CreativeBrief.angle must be a valid AdAngle, received: ${String(props.angle)}`,
        ),
      );
    }
    if (!Object.values(TargetPersona).includes(props.targetPersona)) {
      return err(
        new ValidationError(
          `CreativeBrief.targetPersona must be a valid TargetPersona, received: ${String(props.targetPersona)}`,
        ),
      );
    }
    if (typeof props.primaryMessage !== "string" || props.primaryMessage.trim().length === 0) {
      return err(new ValidationError("CreativeBrief.primaryMessage must be a non-empty string"));
    }
    if (props.formats.length === 0) {
      return err(new ValidationError("CreativeBrief.formats must contain at least one format"));
    }
    if (typeof props.reason !== "string" || props.reason.trim().length === 0) {
      return err(new ValidationError("CreativeBrief.reason must be a non-empty string"));
    }
    return ok(
      new CreativeBrief({
        ...props,
        avoid: [...props.avoid],
        formats: [...props.formats],
        uspMessages: props.uspMessages ? [...props.uspMessages] : undefined,
      }),
    );
  }

  get id(): CreativeBriefId {
    return this.props.id;
  }

  get adId(): string {
    return this.props.adId;
  }

  get unit(): string {
    return this.props.unit;
  }

  get branch(): Branch {
    return this.props.branch;
  }

  get angle(): AdAngle {
    return this.props.angle;
  }

  get targetPersona(): TargetPersona {
    return this.props.targetPersona;
  }

  get primaryMessage(): string {
    return this.props.primaryMessage;
  }

  get tone(): string {
    return this.props.tone;
  }

  get avoid(): ReadonlyArray<string> {
    return this.props.avoid;
  }

  get formats(): ReadonlyArray<CreativeFormat> {
    return this.props.formats;
  }

  get referenceAdId(): string | undefined {
    return this.props.referenceAdId;
  }

  get reason(): string {
    return this.props.reason;
  }

  get urgency(): CreativeUrgency {
    return this.props.urgency;
  }

  get estimatedImpactIfRefreshed(): string {
    return this.props.estimatedImpactIfRefreshed;
  }

  get createdAt(): Date {
    return this.props.createdAt;
  }

  get priceContext(): CreativeBriefPriceContext | undefined {
    return this.props.priceContext;
  }

  get activePromo(): string | undefined {
    return this.props.activePromo;
  }

  get uspMessages(): ReadonlyArray<string> | undefined {
    return this.props.uspMessages;
  }

  get callToAction(): string | undefined {
    return this.props.callToAction;
  }

  get destinationType(): string | undefined {
    return this.props.destinationType;
  }

  get wabaPhoneNumber(): string | undefined {
    return this.props.wabaPhoneNumber;
  }
}
