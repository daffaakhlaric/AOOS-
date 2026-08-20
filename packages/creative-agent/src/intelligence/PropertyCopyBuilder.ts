import { err, ok, type Result } from "@aos/common";
import { ErrorCode } from "@aos/common";

import type { PropertyCreativeBrief } from "../contracts/IPropertyPromptBuilder.js";
import { HEADLINE_MAX_LENGTH, PRIMARY_TEXT_MAX_LENGTH } from "../domain/entities/CopyVariant.js";
import { CreativeAgentError } from "../domain/errors/CreativeAgentError.js";
import { PropertyAdAngle } from "../domain/value-objects/PropertyAdAngle.js";

const CTA_DIRECT = "Tanya Sekarang";
const CTA_LEARN = "Pelajari Selanjutnya";

/** One real Indonesian copy variant `PropertyCopyBuilder.buildVariants` produces — the PROPERTY sibling to `@aos/creative-agent`'s `CopyVariant` entity. Deliberately a plain, already-validated struct rather than a `CopyVariant` instance: `CopyVariant.angle` is hard-typed to `@aos/meta-ads-agent`'s automotive `AdAngle` (see `IPropertyPromptBuilder.ts`'s docstring for the same "don't force a shared vocabulary where it doesn't fit" reasoning), so a PROPERTY variant carries its own `PropertyAdAngle` instead. */
export interface PropertyCopyVariant {
  readonly id: string;
  readonly variantLabel: "A" | "B" | "C";
  readonly angle: PropertyAdAngle;
  readonly primaryText: string;
  readonly headline: string;
  readonly callToAction: string;
}

/** Variant A's opening hook per angle (spec Document 1 Part 6/Document 2 section C — property Kai copy). Exhaustive over all 8 `PropertyAdAngle` members. */
const ANGLE_HOOK: Readonly<Record<PropertyAdAngle, string>> = {
  [PropertyAdAngle.DP_RINGAN]: "DP ringan, langsung bisa dicicil",
  [PropertyAdAngle.READY_HUNI]: "Siap huni, tinggal bawa koper",
  [PropertyAdAngle.INVESTASI]: "Investasi properti yang nilainya terus naik",
  [PropertyAdAngle.EXCLUSIVE]: "Hunian eksklusif untuk keluarga pilihan",
  [PropertyAdAngle.SYARIAH]: "Pembiayaan syariah, halal dan transparan",
  [PropertyAdAngle.PROMO_TERBATAS]: "Promo terbatas, jangan sampai kelewatan",
  [PropertyAdAngle.TESTIMONIAL]: "Sudah dipercaya banyak keluarga bahagia",
  [PropertyAdAngle.VIRTUAL_TOUR]: "Yuk lihat virtual tour-nya dulu",
};

/** Variant B's benefit framing per angle. Exhaustive over all 8 `PropertyAdAngle` members. */
const ANGLE_BENEFIT_PHRASE: Readonly<Record<PropertyAdAngle, string>> = {
  [PropertyAdAngle.DP_RINGAN]: "Keluarga makin mudah punya rumah sendiri",
  [PropertyAdAngle.READY_HUNI]: "Langsung nyaman ditinggali tanpa renovasi",
  [PropertyAdAngle.INVESTASI]: "Aset yang tumbuh nilainya setiap tahun",
  [PropertyAdAngle.EXCLUSIVE]: "Privasi dan kenyamanan kelas atas",
  [PropertyAdAngle.SYARIAH]: "Tenang secara finansial dengan skema syariah",
  [PropertyAdAngle.PROMO_TERBATAS]: "Harga spesial sebelum promo berakhir",
  [PropertyAdAngle.TESTIMONIAL]: "Rasakan pengalaman pemilik yang puas",
  [PropertyAdAngle.VIRTUAL_TOUR]: "Lihat setiap sudut rumah dari HP kamu",
};

/** Variant B's headline suffix per angle — kept short so `${listingTitle} ${suffix}` fits 40 chars for most real listing titles. */
const ANGLE_HEADLINE_SUFFIX: Readonly<Record<PropertyAdAngle, string>> = {
  [PropertyAdAngle.DP_RINGAN]: "DP Ringan",
  [PropertyAdAngle.READY_HUNI]: "Siap Huni",
  [PropertyAdAngle.INVESTASI]: "Investasi Cerdas",
  [PropertyAdAngle.EXCLUSIVE]: "Eksklusif",
  [PropertyAdAngle.SYARIAH]: "Syariah & Halal",
  [PropertyAdAngle.PROMO_TERBATAS]: "Promo Terbatas",
  [PropertyAdAngle.TESTIMONIAL]: "Terpercaya",
  [PropertyAdAngle.VIRTUAL_TOUR]: "Virtual Tour",
};

/** Variant C's proof/trust framing per angle. `SYARIAH`'s entry deliberately contains "syariah"/"halal" (pinned test intent, mirroring `CopyBuilder`'s `KREDIT_SYARIAH` pin). Exhaustive over all 8 `PropertyAdAngle` members. */
const ANGLE_TRUST_PHRASE: Readonly<Record<PropertyAdAngle, string>> = {
  [PropertyAdAngle.DP_RINGAN]: "DP ringan, cicilan transparan",
  [PropertyAdAngle.READY_HUNI]: "Unit siap inspeksi kapan saja",
  [PropertyAdAngle.INVESTASI]: "Lokasi strategis, potensi kenaikan harga tinggi",
  [PropertyAdAngle.EXCLUSIVE]: "Kualitas premium, terverifikasi",
  [PropertyAdAngle.SYARIAH]: "Pembiayaan syariah, halal & transparan",
  [PropertyAdAngle.PROMO_TERBATAS]: "Promo resmi, stok terbatas",
  [PropertyAdAngle.TESTIMONIAL]: "Testimoni asli dari pemilik sebelumnya",
  [PropertyAdAngle.VIRTUAL_TOUR]: "Video tour asli, bukan rendering",
};

/**
 * Generates 3 Indonesian ad copy variants (A/B/C) for a `PropertyCreativeBrief` — the PROPERTY
 * sibling to `CopyBuilder`, mirroring its exact structure (priority-ordered segment assembly via
 * `buildWithinLimit`, Meta's 125/40-char limits enforced here so nothing over-limit is ever
 * produced, same A/B/C CTA convention). `PropertyCreativeBrief` has no `priceContext`/`uspMessages`
 * fields (see `IPropertyPromptBuilder.ts`'s docstring) — `highlights` plays the role
 * `uspMessages` plays for automotive (its first entry is appended to Variant C when there's room),
 * and `angle` alone drives the per-angle hook/benefit/trust phrasing (no price to interpolate).
 */
export class PropertyCopyBuilder {
  buildVariants(
    brief: PropertyCreativeBrief,
  ): Result<ReadonlyArray<PropertyCopyVariant>, CreativeAgentError> {
    const a = this.buildVariantA(brief);
    if (!a.ok) {
      return a;
    }
    const b = this.buildVariantB(brief);
    if (!b.ok) {
      return b;
    }
    const c = this.buildVariantC(brief);
    if (!c.ok) {
      return c;
    }
    return ok([a.value, b.value, c.value]);
  }

  private buildVariantA(
    brief: PropertyCreativeBrief,
  ): Result<PropertyCopyVariant, CreativeAgentError> {
    const segments = [
      `${brief.listingTitle} — ${ANGLE_HOOK[brief.angle]}!`,
      ` Cocok untuk ${brief.propertyType.toLowerCase()} idaman kamu.`,
      firstHighlight(brief) ? ` ${firstHighlight(brief)}.` : "",
      " Tanya detailnya kak 😊",
    ];
    return this.build("A", brief, segments, [`${brief.listingTitle} Ready Sekarang`], CTA_DIRECT);
  }

  private buildVariantB(
    brief: PropertyCreativeBrief,
  ): Result<PropertyCopyVariant, CreativeAgentError> {
    const segments = [
      `${ANGLE_BENEFIT_PHRASE[brief.angle]} di ${brief.listingTitle}.`,
      firstHighlight(brief) ? ` ${firstHighlight(brief)} 😊` : " Kondisi terawat, siap dicek 😊",
    ];
    return this.build(
      "B",
      brief,
      segments,
      [`${brief.listingTitle} ${ANGLE_HEADLINE_SUFFIX[brief.angle]}`],
      CTA_LEARN,
    );
  }

  private buildVariantC(
    brief: PropertyCreativeBrief,
  ): Result<PropertyCopyVariant, CreativeAgentError> {
    const segments = [
      `Listing ${brief.listingTitle} sudah diverifikasi tim kami.`,
      ` ${ANGLE_TRUST_PHRASE[brief.angle]}.`,
      firstHighlight(brief) ? ` ${firstHighlight(brief)}.` : "",
      " Tanya langsung kak! 🙏",
    ];
    return this.build("C", brief, segments, [`${brief.listingTitle} Terverifikasi`], CTA_DIRECT);
  }

  private build(
    variantLabel: "A" | "B" | "C",
    brief: PropertyCreativeBrief,
    primaryTextSegments: readonly string[],
    headlineSegments: readonly string[],
    callToAction: string,
  ): Result<PropertyCopyVariant, CreativeAgentError> {
    const primaryText = buildWithinLimit(primaryTextSegments, PRIMARY_TEXT_MAX_LENGTH);
    const headline = buildWithinLimit(headlineSegments, HEADLINE_MAX_LENGTH);
    if (primaryText.length === 0 || headline.length === 0) {
      /* v8 ignore next 5 -- unreachable: every call site above always supplies a non-empty
         mandatory first segment, and `buildWithinLimit`/`fitToLimit` never reduce a non-empty
         mandatory segment to empty. */
      return err(
        new CreativeAgentError(
          ErrorCode.INTERNAL,
          `PropertyCopyBuilder: variant ${variantLabel} produced an empty field`,
        ),
      );
    }
    return ok({
      id: crypto.randomUUID(),
      variantLabel,
      angle: brief.angle,
      primaryText,
      headline,
      callToAction,
    });
  }
}

function firstHighlight(brief: PropertyCreativeBrief): string | undefined {
  return brief.highlights !== undefined && brief.highlights.length > 0
    ? brief.highlights[0]
    : undefined;
}

/**
 * Appends `segments` in priority order while the running total stays within `maxLen` — identical
 * algorithm to `CopyBuilder`'s own `buildWithinLimit` (duplicated rather than shared across
 * packages/modules, matching this codebase's existing convention of small deterministic
 * intelligence-layer helpers staying self-contained per vertical).
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
