import { err, ok, type Result } from "@aos/common";
import { ErrorCode } from "@aos/common";
import type { ValidationError } from "@aos/errors";
import { AdAngle, type CreativeBrief } from "@aos/meta-ads-agent";

import { CopyVariantBuilder } from "../builders/CopyVariantBuilder.js";
import type { CopyVariant } from "../domain/entities/CopyVariant.js";
import { PRIMARY_TEXT_MAX_LENGTH, HEADLINE_MAX_LENGTH } from "../domain/entities/CopyVariant.js";
import { CreativeAgentError } from "../domain/errors/CreativeAgentError.js";

const CTA_DIRECT = "Tanya Sekarang";
const CTA_LEARN = "Pelajari Selanjutnya";

/** Variant B's short Indonesian benefit framing per angle (spec "Copy Builder" — "Variant B — Benefit focused"). Exhaustive over all 7 `AdAngle` members (COORDINATOR NOTE #5). */
const ANGLE_BENEFIT_PHRASE: Readonly<Record<AdAngle, string>> = {
  [AdAngle.DP_RINGAN]: "Keluarga makin nyaman",
  [AdAngle.KREDIT_SYARIAH]: "Tenang secara finansial dengan skema syariah",
  [AdAngle.GUDANGNYA]: "Pilihan lengkap sesuai kebutuhanmu",
  [AdAngle.QNA]: "Tanya apa saja, kami jawab dengan jujur",
  [AdAngle.DISCOVERY]: "Temukan unit yang paling pas buat kamu",
  [AdAngle.TESTIMONIAL]: "Rasakan pengalaman pelanggan yang puas",
  [AdAngle.WEBSITE_REDIRECT]: "Info lengkap tinggal klik",
};

/** Variant B's headline suffix per angle — kept short so `${unit} ${suffix}` fits 40 chars for most real unit names. */
const ANGLE_HEADLINE_SUFFIX: Readonly<Record<AdAngle, string>> = {
  [AdAngle.DP_RINGAN]: "Harga Terjangkau",
  [AdAngle.KREDIT_SYARIAH]: "Syariah & Halal",
  [AdAngle.GUDANGNYA]: "Stok Lengkap",
  [AdAngle.QNA]: "Info Jujur",
  [AdAngle.DISCOVERY]: "Pilihan Tepat",
  [AdAngle.TESTIMONIAL]: "Pelanggan Puas",
  [AdAngle.WEBSITE_REDIRECT]: "Cek Selengkapnya",
};

/** Variant C's proof/trust framing per angle (spec "Copy Builder" — "Variant C — Proof / Trust focused"). `KREDIT_SYARIAH`'s entry deliberately contains "syariah"/"halal" (pinned test intent). */
const ANGLE_TRUST_PHRASE: Readonly<Record<AdAngle, string>> = {
  [AdAngle.DP_RINGAN]: "DP ringan, cicilan transparan",
  [AdAngle.KREDIT_SYARIAH]: "Pembiayaan syariah, halal & transparan",
  [AdAngle.GUDANGNYA]: "Stok lengkap, semua unit siap inspeksi",
  [AdAngle.QNA]: "Info jujur, siap jawab semua pertanyaan",
  [AdAngle.DISCOVERY]: "Bandingkan dulu, baru putuskan",
  [AdAngle.TESTIMONIAL]: "Testimoni asli dari pelanggan yang puas",
  [AdAngle.WEBSITE_REDIRECT]: "Cek detail lengkap di website kami",
};

/**
 * Generates 3 Indonesian ad copy variants (A/B/C) from a `CreativeBrief` (spec "Copy Builder
 * (Indonesian)"). Fully deterministic template rendering — no LLM calls. Every variant is
 * assembled from a priority-ordered list of text segments (`buildWithinLimit`): mandatory
 * segments first, optional segments (price, promo, USP) appended only while the running total
 * still respects Meta's 125/40-char limits — so `CopyVariant.create`'s own validation (mission
 * brief: "validate this in the `CopyVariant` domain entity itself") never actually rejects
 * anything this builder produces, it just never gets the chance to receive an over-limit string.
 *
 * COORDINATOR NOTE #4 applied: `brief.uspMessages` (already Indonesian, unlike the English-only
 * `AutomotivePromptBuilder`) is used directly here — its first entry is appended to Variant C
 * (Proof/Trust framing) when there's room, using the USP selection Tamara already made via
 * `BusinessKnowledgeBase.ANGLE_USP_MAP` "for Kai's convenience".
 */
export class CopyBuilder {
  buildVariants(brief: CreativeBrief): Result<ReadonlyArray<CopyVariant>, CreativeAgentError> {
    const variants: CopyVariant[] = [];

    const a = this.buildVariantA(brief);
    /* v8 ignore start -- unreachable: `buildWithinLimit` guarantees `primaryText`/`headline` are
       always non-empty and within the 125/40-char limits, which are `CopyVariant.create`'s only
       failure modes, so `CopyVariantBuilder.build` can never return `err` here. */
    if (!a.ok) {
      return err(
        new CreativeAgentError(
          ErrorCode.INTERNAL,
          `CopyBuilder: variant A build failed: ${a.error.message}`,
        ),
      );
    }
    /* v8 ignore stop */
    variants.push(a.value);

    const b = this.buildVariantB(brief);
    /* v8 ignore start -- unreachable, same reasoning as variant A above. */
    if (!b.ok) {
      return err(
        new CreativeAgentError(
          ErrorCode.INTERNAL,
          `CopyBuilder: variant B build failed: ${b.error.message}`,
        ),
      );
    }
    /* v8 ignore stop */
    variants.push(b.value);

    const c = this.buildVariantC(brief);
    /* v8 ignore start -- unreachable, same reasoning as variant A above. */
    if (!c.ok) {
      return err(
        new CreativeAgentError(
          ErrorCode.INTERNAL,
          `CopyBuilder: variant C build failed: ${c.error.message}`,
        ),
      );
    }
    /* v8 ignore stop */
    variants.push(c.value);

    return ok(variants);
  }

  private buildVariantA(brief: CreativeBrief): Result<CopyVariant, ValidationError> {
    const dp = brief.priceContext ? formatRupiahJuta(brief.priceContext.estimatedDp) : undefined;
    const monthly = brief.priceContext
      ? formatRupiahJuta(brief.priceContext.estimatedMonthly)
      : undefined;

    const segments = [
      `${brief.unit} udah bisa kamu bawa pulang!`,
      dp && monthly
        ? ` DP cuma ${dp}, cicilan mulai ${monthly}/bulan.`
        : ` ${brief.primaryMessage}.`,
      brief.activePromo ? ` Promo ${brief.activePromo}.` : "",
      brief.urgency === "LOW" ? " Yuk tanya-tanya dulu kak 😊" : " Stok terbatas kak 😊",
    ];
    const primaryText = buildWithinLimit(segments, PRIMARY_TEXT_MAX_LENGTH);

    const headlineDp = brief.priceContext
      ? formatRupiahJutaTitle(brief.priceContext.estimatedDp)
      : undefined;
    const headline = buildWithinLimit(
      [headlineDp ? `DP ${headlineDp} Bawa Pulang ${brief.unit}` : `${brief.unit} Ready Sekarang`],
      HEADLINE_MAX_LENGTH,
    );

    return CopyVariantBuilder.build({
      variantLabel: "A",
      angle: brief.angle,
      primaryText,
      headline,
      callToAction: CTA_DIRECT,
    });
  }

  private buildVariantB(brief: CreativeBrief): Result<CopyVariant, ValidationError> {
    const dp = brief.priceContext ? formatRupiahJuta(brief.priceContext.estimatedDp) : undefined;

    const segments = [
      `${ANGLE_BENEFIT_PHRASE[brief.angle]} dengan ${brief.unit}.`,
      dp ? ` DP ringan mulai ${dp} 😊` : ` Kondisi prima, harga transparan 😊`,
      brief.activePromo ? ` Promo ${brief.activePromo}.` : "",
    ];
    const primaryText = buildWithinLimit(segments, PRIMARY_TEXT_MAX_LENGTH);

    const headline = buildWithinLimit(
      [`${brief.unit} ${ANGLE_HEADLINE_SUFFIX[brief.angle]}`],
      HEADLINE_MAX_LENGTH,
    );

    return CopyVariantBuilder.build({
      variantLabel: "B",
      angle: brief.angle,
      primaryText,
      headline,
      callToAction: CTA_LEARN,
    });
  }

  private buildVariantC(brief: CreativeBrief): Result<CopyVariant, ValidationError> {
    const dp = brief.priceContext ? formatRupiahJuta(brief.priceContext.estimatedDp) : undefined;
    const firstUsp =
      brief.uspMessages && brief.uspMessages.length > 0 ? brief.uspMessages[0] : undefined;

    const segments = [
      "Semua unit Mobix diinspeksi 150+ titik & diverifikasi Otospector.",
      ` ${ANGLE_TRUST_PHRASE[brief.angle]}.`,
      firstUsp ? ` ${firstUsp}.` : "",
      dp ? ` ${brief.unit} ready, DP ${dp}.` : ` ${brief.unit} ready.`,
      " Tanya langsung kak! 🙏",
    ];
    const primaryText = buildWithinLimit(segments, PRIMARY_TEXT_MAX_LENGTH);

    const headlineDp = brief.priceContext
      ? formatRupiahJutaTitle(brief.priceContext.estimatedDp)
      : undefined;
    const headline = buildWithinLimit(
      [`${brief.unit} Terverifikasi${headlineDp ? `, DP ${headlineDp}` : ""}`],
      HEADLINE_MAX_LENGTH,
    );

    return CopyVariantBuilder.build({
      variantLabel: "C",
      angle: brief.angle,
      primaryText,
      headline,
      callToAction: CTA_DIRECT,
    });
  }
}

/**
 * Appends `segments` in priority order while the running total stays within `maxLen`. The first
 * segment is mandatory: if it alone already exceeds `maxLen` (only possible for pathologically
 * long `unit` names), it is hard-truncated via `fitToLimit`. Every later segment is optional and
 * silently skipped once it would push the total over the limit — this is what guarantees
 * `CopyBuilder` never hands `CopyVariant.create` an over-limit string.
 */
function buildWithinLimit(segments: ReadonlyArray<string>, maxLen: number): string {
  let result = "";
  for (const segment of segments) {
    if (segment.length === 0) {
      continue;
    }
    if (result.length === 0) {
      result = fitToLimit(segment, maxLen);
      continue;
    }
    const candidate = result + segment;
    if (candidate.length <= maxLen) {
      result = candidate;
    }
  }
  return result;
}

function fitToLimit(text: string, maxLen: number): string {
  if (text.length <= maxLen) {
    return text;
  }
  return text.slice(0, Math.max(0, maxLen - 1)) + "…";
}

/** `29_000_000` -> `"29 juta"`; `5_400_000` -> `"5,4 juta"` (Indonesian decimal comma, trailing `.0` dropped). */
function formatRupiahJuta(amountIDR: number): string {
  const juta = Math.round((amountIDR / 1_000_000) * 10) / 10;
  if (Number.isInteger(juta)) {
    return `${juta} juta`;
  }
  return `${juta.toFixed(1).replace(".", ",")} juta`;
}

/** Headline-cased variant of `formatRupiahJuta` — `29_000_000` -> `"29 Juta"`, used where a capitalized "Juta" reads better mid-headline. */
function formatRupiahJutaTitle(amountIDR: number): string {
  return formatRupiahJuta(amountIDR).replace("juta", "Juta");
}
