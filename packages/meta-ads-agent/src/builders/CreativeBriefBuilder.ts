import { err, ok, type Result } from "@aos/common";
import { formatIDR, type Ad, type AdAccount, type Branch } from "@aos/meta-ads-connector";
import type { ScrapedUnit } from "@aos/mobix-web-scraper";

import type { ICreativeBriefGenerator } from "../contracts/ICreativeBriefGenerator.js";
import type { AgentMemory } from "../domain/entities/AgentMemory.js";
import { CreativeBrief, type CreativeBriefPriceContext } from "../domain/entities/CreativeBrief.js";
import { DecisionError } from "../domain/errors/index.js";
import { AdAngle } from "../domain/value-objects/AdAngle.js";
import { CreativeBriefId } from "../domain/value-objects/CreativeBriefId.js";
import { TargetPersona } from "../domain/value-objects/TargetPersona.js";
import { AngleRecommender } from "../intelligence/AngleRecommender.js";
import {
  AAOS_CAMPAIGN_DEFAULTS,
  ANGLE_USP_MAP,
  BusinessKnowledgeBase,
  TOP_UNITS,
} from "../intelligence/BusinessKnowledgeBase.js";
import type { CreativeFormat, CreativeUrgency } from "../types/AgentTypes.js";

const LOAN_TENOR_MONTHS = 48;
const FLAT_MONTHLY_RATE = 0.012;

/** `loan/tenor + loan*monthlyRate`, flat-rate installment estimate — AAOS-W1D-S1S2 (S2). Verified against the spec's worked example (loan Rp 166.000.000 → ≈ Rp 5.447.333, within the spec's own documented ±Rp100.000 tolerance). */
export function calculateMonthly(loanIDR: number): number {
  return Math.round(loanIDR / LOAN_TENOR_MONTHS + loanIDR * FLAT_MONTHLY_RATE);
}

const ANGLE_MESSAGES: Record<AdAngle, string> = {
  [AdAngle.DP_RINGAN]: "DP mulai 20 juta langsung bisa bawa pulang",
  [AdAngle.KREDIT_SYARIAH]: "Kredit syariah, halal, tanpa riba",
  [AdAngle.GUDANGNYA]: "Gudangnya unit siap pilih, stok lengkap",
  [AdAngle.QNA]: "Tanya jawab seputar mobil bekas, edukasi dulu sebelum beli",
  [AdAngle.DISCOVERY]: "Budget segini dapat mobil apa? Cek pilihannya",
  [AdAngle.TESTIMONIAL]: "Cerita pelanggan yang sudah beli, bukti nyata",
  // AAOS-W1D-S1S2 (S1) addition — `AngleRecommender.recommend()` never selects this angle as
  // rank 0 (see `formatsFor`'s docstring for the same "genuinely unreachable" reasoning), so this
  // entry exists only to keep `ANGLE_MESSAGES` a total `Record<AdAngle, string>`.
  [AdAngle.WEBSITE_REDIRECT]: "Cek katalog lengkap di website, semua unit ready",
};

/**
 * `Ad.create` rejects a blank/whitespace-only name, so `split(/\s+/)[0]` on any real `Ad.name`
 * always yields a defined, non-empty element — asserted rather than defaulted with `?? unit` to
 * avoid an unreachable branch purely satisfying TypeScript's `string | undefined` array-index
 * inference.
 */
function unitKeyOf(unit: string): string {
  const upper = unit.toUpperCase();
  if (upper.includes("XPANDER")) return "XPANDER";
  if (upper.includes("BRIO")) return "BRIO";
  const firstWord = unit.split(/\s+/)[0] as string;
  return firstWord.toUpperCase();
}

/**
 * Generates a `CreativeBrief` for a REFRESH-verdict ad.
 *
 * `referenceAdId` rule (judgment call, documented per task guidance): the reference ad is the
 * lowest-`rphD3` ad among OTHER ads in the same branch + same unit-key context as the ad being
 * refreshed; when no such same-context peer with a defined `rphD3` exists, falls back to the
 * account-wide lowest-`rphD3` ad (excluding the ad itself). `undefined` when no ad in the whole
 * account has a defined `rphD3`.
 */
export class CreativeBriefBuilder implements ICreativeBriefGenerator {
  /**
   * `ctwaPhoneNumbers` is AAOS-W1D-S3 (coordinator note correction #6) — sourced from
   * `MetaAdsAgentConfig.ctwaPhoneNumbers` at composition time (`TamaraAgentFactory`), never read
   * from `process.env` here. Added as a second, defaulted parameter (rather than threading it
   * through `generate()`, which would break `ICreativeBriefGenerator`'s existing signature) so
   * every pre-existing call site (`new CreativeBriefBuilder(now)`) keeps compiling unchanged.
   */
  constructor(
    private readonly now: () => Date = () => new Date(),
    private readonly ctwaPhoneNumbers: Partial<Record<Branch, string>> = {},
  ) {}

  generate(
    ad: Ad,
    adAccount: AdAccount,
    memory?: AgentMemory,
  ): Result<CreativeBrief, DecisionError> {
    const allAds: Ad[] = [];
    for (const campaign of adAccount.campaigns) {
      for (const adSet of campaign.adSets) {
        for (const candidate of adSet.ads) {
          allAds.push(candidate);
        }
      }
    }

    // AAOS-W1D-S1S2 (S1) — memory-aware angle selection (3-tier) when memory is supplied,
    // otherwise unchanged W1D-base static ranking.
    const angle = memory
      ? AngleRecommender.selectBestAngle(ad.branch, ad.name, memory)
      : AngleRecommender.recommend(ad.branch, ad.name);
    // SECONDARY_BUSINESS's `units` is always populated (see BusinessKnowledgeBase) — asserted
    // rather than defaulted with `?? []` to avoid an unreachable branch.
    const nicheKeywords = BusinessKnowledgeBase.persona(TargetPersona.SECONDARY_BUSINESS)
      .units as ReadonlyArray<string>;
    const nameLower = ad.name.toLowerCase();
    const targetPersona = nicheKeywords.some((unitKeyword) =>
      nameLower.includes(unitKeyword.toLowerCase()),
    )
      ? TargetPersona.SECONDARY_BUSINESS
      : TargetPersona.PRIMARY_FAMILY;

    const referenceAdId = this.selectReferenceAd(ad, allAds);
    const frequency = ad.metrics.frequency;
    const urgency = this.urgencyFor(frequency);

    const priceInfo = memory ? this.buildPriceContext(ad, memory) : undefined;
    const primaryMessage = priceInfo
      ? `DP mulai ${formatIDR(priceInfo.context.estimatedDp)} langsung bawa pulang ${priceInfo.unit.model} ${priceInfo.unit.year}`
      : ANGLE_MESSAGES[angle];
    const relevantPromo = memory
      ? memory.activePromos.find(
          (p) =>
            p.isActive(this.now()) && p.appliesToUnit(priceInfo?.unit.model ?? unitKeyOf(ad.name)),
        )
      : undefined;

    const briefResult = CreativeBrief.create({
      id: CreativeBriefId.generate(),
      adId: ad.id.toString(),
      unit: ad.name,
      branch: ad.branch,
      angle,
      targetPersona,
      primaryMessage,
      tone: "casual, relatable, tidak formal",
      avoid: ["terlalu banyak text", "angle harga saja"],
      formats: this.formatsFor(angle),
      referenceAdId,
      reason: `frequency ${frequency.toFixed(1)}x, audience jenuh`,
      urgency,
      estimatedImpactIfRefreshed: "target -40% Rp/D3",
      createdAt: this.now(),
      priceContext: priceInfo?.context,
      activePromo: relevantPromo?.title,
      uspMessages: memory ? ANGLE_USP_MAP[angle] : undefined,
      // AAOS-W1D-S3: every brief tells Kai it's a CTWA WhatsApp creative — always
      // SEND_WHATSAPP_MESSAGE / WHATSAPP, per DSS Motor's real strategy.
      callToAction: AAOS_CAMPAIGN_DEFAULTS.callToAction,
      destinationType: AAOS_CAMPAIGN_DEFAULTS.destinationType,
      wabaPhoneNumber: this.ctwaPhoneNumbers[ad.branch],
    });
    /* v8 ignore next 5 */
    if (!briefResult.ok) {
      // Unreachable: every field above is derived from an already-validated `Ad` plus this file's
      // own enum-backed lookups — never externally supplied, never invalid.
      return err(new DecisionError(briefResult.error.message));
    }
    return ok(briefResult.value);
  }

  private selectReferenceAd(ad: Ad, allAds: ReadonlyArray<Ad>): string | undefined {
    const others = allAds.filter((candidate) => !candidate.id.equals(ad.id));
    const unitKey = unitKeyOf(ad.name);

    const sameContext = others.filter(
      (candidate) =>
        candidate.branch === ad.branch &&
        unitKeyOf(candidate.name) === unitKey &&
        candidate.metrics.rphD3.isDefined(),
    );
    const best = this.lowestRphD3(sameContext);
    if (best) {
      return best.id.toString();
    }

    const accountWide = others.filter((candidate) => candidate.metrics.rphD3.isDefined());
    const fallback = this.lowestRphD3(accountWide);
    return fallback?.id.toString();
  }

  /** `ads` is always pre-filtered to `rphD3.isDefined()` entries by both call sites, so `.value` is asserted (never `?? 0`) — avoiding an unreachable branch. */
  private lowestRphD3(ads: ReadonlyArray<Ad>): Ad | undefined {
    if (ads.length === 0) {
      return undefined;
    }
    return [...ads].sort(
      (a, b) => (a.metrics.rphD3.value as number) - (b.metrics.rphD3.value as number),
    )[0];
  }

  /**
   * AAOS-W1D-S1S2 (S2) — finds the cheapest in-stock unit at `ad.branch` matching the model
   * detected in `ad.name` (via `TOP_UNITS`, falling back to `unitKeyOf`'s first-word heuristic),
   * and computes its price context. `undefined` when no matching unit is currently in stock at
   * this branch — the caller falls back to the generic `ANGLE_MESSAGES` primary message.
   */
  private buildPriceContext(
    ad: Ad,
    memory: AgentMemory,
  ): { readonly context: CreativeBriefPriceContext; readonly unit: ScrapedUnit } | undefined {
    const nameLower = ad.name.toLowerCase();
    const unitProfile = TOP_UNITS.find((u) => nameLower.includes(u.model.toLowerCase()));
    const modelQuery = unitProfile?.model ?? unitKeyOf(ad.name);

    const branchUnits = memory.inventoryByBranch.get(ad.branch) ?? [];
    const matches = branchUnits.filter((u) => u.matchesModel(modelQuery));
    if (matches.length === 0) {
      return undefined;
    }
    const cheapest = [...matches].sort((a, b) => a.price.idr - b.price.idr)[0] as ScrapedUnit;

    const estimatedDp = Math.round((cheapest.price.idr * 0.15) / 1_000_000) * 1_000_000;
    const loanIDR = cheapest.price.idr - estimatedDp;
    const estimatedMonthly = calculateMonthly(loanIDR);

    return {
      unit: cheapest,
      context: {
        unitPrice: cheapest.price.idr,
        estimatedDp,
        estimatedMonthly,
        year: cheapest.year,
        kilometer: cheapest.kilometer.km,
      },
    };
  }

  private urgencyFor(frequency: number): CreativeUrgency {
    if (frequency > 4.5) {
      return "HIGH";
    }
    if (frequency > 3) {
      return "MEDIUM";
    }
    return "LOW";
  }

  /**
   * Judgment call, simplified: `AngleRecommender.recommend` always returns a `rank(...)[0]` (or
   * the `[DP_RINGAN]` default) — per `AngleRecommender`'s own table, only `DP_RINGAN`/`GUDANGNYA`
   * ever occupy rank 0, so `TESTIMONIAL`/`QNA`-specific format guidance would be genuinely
   * unreachable dead code here (they only ever appear at rank 2-3, never selected by `generate()`).
   * One format pair covers every angle this method actually receives.
   */
  private formatsFor(_angle: AdAngle): ReadonlyArray<CreativeFormat> {
    return ["VIDEO_15S", "IMAGE_SQUARE"];
  }
}
