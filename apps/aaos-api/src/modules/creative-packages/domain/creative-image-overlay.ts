import { LayoutFamily } from "@aos/creative-agent";
import { formatIDR } from "@aos/meta-ads-connector";
import type sharpDefault from "sharp";

/**
 * PROMPT 57 — GENERATIVE VISUAL + DETERMINISTIC TYPOGRAPHY (Phase 29).
 *
 * The spec's own core principle (`PROMPT 57`'s literal wording): "Do NOT trust image generation
 * model for exact: price / headline / logo / CTA / specification / legal text." KIE.ai's own model
 * only ever gets an English SCENE prompt (`PropertyPromptBuilder` — explicitly "no text overlay" in
 * its own video-prompt template) — whatever price/CTA text a model might still render into pixels on
 * its own is never trusted, verified, or relied on anywhere in this pipeline. This module is the
 * FIRST real place in the codebase that deterministically composites REAL, already-computed text
 * (the listing's actual price via `@aos/meta-ads-connector`'s `formatIDR` — the SAME formatter
 * `PropertyCopyBuilder`'s own copy interpolation uses, never a second currency formatter; the real
 * LLM-or-deterministic `headline`/`callToAction` `StoredCopyVariant` fields `buildPropertyCopyVariants`
 * already produces) onto the generated base image, at one fixed, honest bottom-banner position.
 *
 * SCOPE (deliberately, per this dispatch's own boundary): ONE fixed layout — a semi-transparent
 * bottom banner, price large/bold, headline smaller beneath it, CTA as a small pill on the right.
 * `imageAspectRatio`-aware positioning is intentionally NOT attempted here; the banner is sized as a
 * fraction of the actual image height/width sharp reports for THIS buffer, so it degrades sanely
 * across 1:1/9:16/16:9 without a second code path per ratio.
 *
 * HONEST DEGRADE: every failure mode (sharp not resolving image dimensions, a corrupt buffer, an
 * SVG/library exception) returns `{ ok: false, reason }` — it NEVER throws, and NEVER returns a
 * buffer that silently failed to receive its text. The caller (`CreativePackagesService`) is
 * responsible for falling back to the original, un-composited buffer and logging the honest reason;
 * this module has no opinion on what "good enough" means for the pipeline, only on whether ITS OWN
 * compositing genuinely succeeded.
 *
 * PROMPT 58 — DYNAMIC LAYOUT ENGINE (Phase 37). This module's original ONE-fixed-layout scope above
 * is now the honest DEFAULT of a small, ADDITIVE, OPT-IN extension: `TypographyOverlayInput.layoutFamily`
 * lets a caller request one of the spec's real 11 `LayoutFamily` names (`@aos/creative-agent`'s
 * `LayoutFamily.ts`). Exactly 2 are genuinely implemented with distinct pixel-positioning logic —
 * `IMPLEMENTED_LAYOUT_FAMILIES` below is the honest, single source of truth for which:
 *   - `BOTTOM_INFO_BAR` — the ORIGINAL fixed layout described above, byte-for-byte unchanged.
 *   - `HERO_FULL_BLEED` — a genuinely different treatment: no full-width banner rect at all: a small
 *     price badge top-right, a thin bottom caption strip (headline only, far shorter than the
 *     default banner) and a compact CTA pill inside it, so the generated image itself stays visually
 *     dominant. See `buildHeroFullBleedSvg`.
 * Every OTHER `LayoutFamily` (the remaining 9 real spec names — `ASYMMETRIC_EDITORIAL`,
 * `PRICE_DOMINANT`, `FLOATING_CARD`, `SPLIT_SCREEN`, `MAP_HYBRID`, `EDITORIAL_LUXURY`, `SPEC_GRID`,
 * `MORTGAGE_CARD`, `PROPERTY_DISCOVERY`) has no bespoke positioning logic yet and honestly falls
 * back to `BOTTOM_INFO_BAR`'s exact compositing — never a silently broken/overlapping layout. A
 * caller that omits `layoutFamily` entirely gets `BOTTOM_INFO_BAR` too: ZERO behavior change for
 * every existing caller (`CreativePackagesService`, Phase 29/30) that doesn't opt in.
 */

export interface TypographyOverlayInput {
  /** The real JPEG bytes Kie AI returned for one generated image — the exact buffer this pipeline already QA-checks and uploads. */
  readonly imageBuffer: Buffer;
  /** Real, whole-Rupiah listing price (`PropertyCreativeBrief.price`) — omitted (never fabricated) when the listing has none. */
  readonly priceRupiah?: number;
  /** The real, already-computed `StoredCopyVariant.headline` for the variant this package will lead with. */
  readonly headline?: string;
  /** The real, already-computed `StoredCopyVariant.callToAction` label. */
  readonly ctaText?: string;
  /**
   * PROMPT 46 — PROPERTY INTEGRITY MODES (Phase 30). The real disclosure text
   * (`@aos/creative-agent`'s `ILUSTRASI_LABEL`) composited as a small top-left corner badge,
   * independent of the bottom price/headline/CTA banner above — set ONLY when the caller has
   * determined (via `decidePropertyIntegrityMode`) that this listing is `CONCEPTUAL` (land/an
   * unrecognized `propertyType`), never fabricated for a real, STRICT built unit.
   */
  readonly label?: string;
  /**
   * PROMPT 58 — DYNAMIC LAYOUT ENGINE (Phase 37). Optional, additive: which of the spec's real
   * `LayoutFamily` names to arrange this text in. Omitted (the exact existing behavior of every
   * Phase 29/30 caller) or any family not in `IMPLEMENTED_LAYOUT_FAMILIES` honestly falls back to
   * the original `BOTTOM_INFO_BAR` bottom-banner layout — see this file's own module doc.
   */
  readonly layoutFamily?: LayoutFamily;
}

export type TypographyOverlayResult =
  { readonly ok: true; readonly buffer: Buffer } | { readonly ok: false; readonly reason: string };

/** Fraction of the real image height the bottom banner occupies. Fixed — not part of a layout engine. */
const BANNER_HEIGHT_FRACTION = 0.22;
const BANNER_OPACITY = 0.72;
const PRICE_FONT_FRACTION = 0.072;
const HEADLINE_FONT_FRACTION = 0.036;
const CTA_FONT_FRACTION = 0.032;
const SIDE_PADDING_FRACTION = 0.045;
/** PROMPT 46 — the ILUSTRASI corner badge's font size and padding, as fractions of real image height/width — same "fraction of the actual measured buffer" discipline every other constant here already follows, so it degrades sanely across 1:1/9:16/16:9 too. */
const LABEL_FONT_FRACTION = 0.04;
const LABEL_PADDING_FRACTION = 0.018;
const LABEL_OPACITY = 0.85;

/**
 * PROMPT 58 — the only `LayoutFamily` members with real, bespoke pixel-positioning logic today.
 * Single source of truth for `resolveImplementedLayout` below — any `LayoutFamily` NOT in this set
 * (9 of the real 11 spec names) honestly degrades to `LayoutFamily.BOTTOM_INFO_BAR`.
 */
const IMPLEMENTED_LAYOUT_FAMILIES: ReadonlySet<LayoutFamily> = new Set([
  LayoutFamily.BOTTOM_INFO_BAR,
  LayoutFamily.HERO_FULL_BLEED,
]);

/** `HERO_FULL_BLEED`'s own fraction-of-real-image-dimensions constants — genuinely distinct from the `BOTTOM_INFO_BAR` constants above, never reused, so the two layouts can never accidentally collapse into the same output. */
const HERO_PRICE_FONT_FRACTION = 0.06;
const HERO_PRICE_BADGE_OPACITY = 0.75;
const HERO_PRICE_BADGE_PADDING_FRACTION = 0.022;
const HERO_CAPTION_HEIGHT_FRACTION = 0.1;
const HERO_CAPTION_OPACITY = 0.6;
const HERO_HEADLINE_FONT_FRACTION = 0.03;
const HERO_CTA_FONT_FRACTION = 0.028;
const HERO_SIDE_PADDING_FRACTION = 0.045;

/**
 * Resolves a caller's optional `layoutFamily` request to the one `LayoutFamily` this module will
 * actually render — `undefined` and every unimplemented family both honestly resolve to
 * `BOTTOM_INFO_BAR`, the original Phase 29/30 default. Never throws, never returns a family absent
 * from `IMPLEMENTED_LAYOUT_FAMILIES`.
 */
function resolveImplementedLayout(requested: LayoutFamily | undefined): LayoutFamily {
  return requested !== undefined && IMPLEMENTED_LAYOUT_FAMILIES.has(requested)
    ? requested
    : LayoutFamily.BOTTOM_INFO_BAR;
}

/**
 * Deterministically composites the real price/headline/CTA text onto a real generated JPEG buffer at
 * one fixed bottom-banner position. `undefined` for the sharp module load itself is impossible at
 * runtime (a real, declared dependency — see `package.json`), but every OTHER failure mode (unreadable
 * dimensions, a corrupt buffer, an encoding exception) is caught and returned as an honest
 * `{ ok: false }` — never thrown, never a silently-broken "success".
 */
export async function applyTypographyOverlay(
  input: TypographyOverlayInput,
): Promise<TypographyOverlayResult> {
  if (
    input.priceRupiah === undefined &&
    (input.headline === undefined || input.headline.length === 0) &&
    (input.ctaText === undefined || input.ctaText.length === 0) &&
    (input.label === undefined || input.label.length === 0)
  ) {
    return { ok: false, reason: "no_real_text_fields_provided" };
  }

  let sharpFactory: typeof sharpDefault;
  try {
    sharpFactory = (await import("sharp")).default;
  } catch (caught) {
    return {
      ok: false,
      reason: `sharp_unavailable: ${caught instanceof Error ? caught.message : String(caught)}`,
    };
  }

  try {
    const base = sharpFactory(input.imageBuffer);
    const metadata = await base.metadata();
    const width = metadata.width;
    const height = metadata.height;
    if (width === undefined || height === undefined || width <= 0 || height <= 0) {
      return { ok: false, reason: "unreadable_image_dimensions" };
    }

    const svg = buildOverlaySvg({
      width,
      height,
      priceText: input.priceRupiah !== undefined ? formatIDR(input.priceRupiah) : undefined,
      headline: nonEmpty(input.headline),
      ctaText: nonEmpty(input.ctaText),
      label: nonEmpty(input.label),
      layoutFamily: resolveImplementedLayout(input.layoutFamily),
    });

    const composited = await sharpFactory(input.imageBuffer)
      .composite([{ input: Buffer.from(svg), top: 0, left: 0 }])
      .jpeg({ quality: 92 })
      .toBuffer();

    return { ok: true, buffer: composited };
  } catch (caught) {
    return {
      ok: false,
      reason: `composite_failed: ${caught instanceof Error ? caught.message : String(caught)}`,
    };
  }
}

function nonEmpty(value: string | undefined): string | undefined {
  return value !== undefined && value.length > 0 ? value : undefined;
}

interface OverlaySvgInput {
  readonly width: number;
  readonly height: number;
  readonly priceText?: string;
  readonly headline?: string;
  readonly ctaText?: string;
  /** PROMPT 46 — the real "ILUSTRASI" disclosure text, when the caller determined this listing is `CONCEPTUAL`. */
  readonly label?: string;
  /** PROMPT 58 — already resolved to an `IMPLEMENTED_LAYOUT_FAMILIES` member by `resolveImplementedLayout`; never the raw, possibly-unimplemented caller request. */
  readonly layoutFamily: LayoutFamily;
}

/**
 * Builds the fixed bottom-banner SVG sharp composites on top of the real base image. One layout,
 * always: a semi-transparent black rectangle across the full width at the bottom
 * (`BANNER_HEIGHT_FRACTION` of the real image height), the real price top-left (large/bold), the
 * real headline beneath it (smaller), and the real CTA as a small rounded pill bottom-right — sized
 * and positioned purely as fractions of the ACTUAL `width`/`height` sharp measured for this buffer,
 * so the same one layout degrades sanely across every real `AspectRatio` this pipeline produces
 * (1:1 / 9:16 / 16:9) without a per-ratio branch. Every dynamic value is XML-escaped — this is
 * genuinely untrusted text (an LLM-generated headline, a listing's own price) rendered into markup.
 */
function buildOverlaySvg(input: OverlaySvgInput): string {
  if (input.layoutFamily === LayoutFamily.HERO_FULL_BLEED) {
    return buildHeroFullBleedSvg(input);
  }
  return buildBottomInfoBarSvg(input);
}

/**
 * The original, unchanged (Phase 29/30) `BOTTOM_INFO_BAR` layout: a semi-transparent bottom banner,
 * price top-left, headline beneath it, CTA pill bottom-right. This is `resolveImplementedLayout`'s
 * default AND every unimplemented `LayoutFamily`'s honest fallback.
 */
function buildBottomInfoBarSvg(input: OverlaySvgInput): string {
  const { width, height } = input;
  const bannerHeight = Math.round(height * BANNER_HEIGHT_FRACTION);
  const bannerY = height - bannerHeight;
  const sidePadding = Math.round(width * SIDE_PADDING_FRACTION);
  const priceFontSize = Math.round(height * PRICE_FONT_FRACTION);
  const headlineFontSize = Math.round(height * HEADLINE_FONT_FRACTION);
  const ctaFontSize = Math.round(height * CTA_FONT_FRACTION);

  const priceY = bannerY + priceFontSize + Math.round(bannerHeight * 0.18);
  const headlineY = priceY + headlineFontSize + Math.round(bannerHeight * 0.12);

  const priceLine =
    input.priceText !== undefined
      ? `<text x="${String(sidePadding)}" y="${String(priceY)}" font-family="Arial, sans-serif" font-size="${String(priceFontSize)}" font-weight="700" fill="#FFFFFF">${escapeXml(input.priceText)}</text>`
      : "";
  const headlineLine =
    input.headline !== undefined
      ? `<text x="${String(sidePadding)}" y="${String(headlineY)}" font-family="Arial, sans-serif" font-size="${String(headlineFontSize)}" font-weight="400" fill="#F5F5F5">${escapeXml(truncateForSvg(input.headline, 70))}</text>`
      : "";

  const ctaGroup = buildCtaPill(input.ctaText, {
    width,
    bannerY,
    bannerHeight,
    sidePadding,
    ctaFontSize,
  });

  const labelGroup = buildLabelBadge(input.label, { width, height });

  return (
    `<svg width="${String(width)}" height="${String(height)}" xmlns="http://www.w3.org/2000/svg">` +
    `<rect x="0" y="${String(bannerY)}" width="${String(width)}" height="${String(bannerHeight)}" fill="#000000" fill-opacity="${String(BANNER_OPACITY)}" />` +
    `${priceLine}${headlineLine}${ctaGroup}${labelGroup}` +
    `</svg>`
  );
}

/**
 * PROMPT 58 — `LayoutFamily.HERO_FULL_BLEED`. Genuinely different pixel-positioning from
 * `buildBottomInfoBarSvg`: NO full-width banner rectangle at all — the real generated image stays
 * visually dominant. Instead: a compact semi-transparent price badge in the TOP-RIGHT corner (the
 * `buildLabelBadge` ILUSTRASI badge already independently owns the top-left corner — see that
 * function's own doc — so this never competes with it for the same space regardless of which
 * fields a given call provides), a thin bottom caption strip (`HERO_CAPTION_HEIGHT_FRACTION`, far
 * shorter than `BANNER_HEIGHT_FRACTION`) carrying only the headline, and a compact CTA pill inside
 * that same strip. Every value is a fraction of the ACTUAL measured `width`/`height`, same
 * discipline as the default layout, so it degrades sanely across 1:1/9:16/16:9 too.
 */
function buildHeroFullBleedSvg(input: OverlaySvgInput): string {
  const { width, height } = input;
  const sidePadding = Math.round(width * HERO_SIDE_PADDING_FRACTION);
  const priceFontSize = Math.round(height * HERO_PRICE_FONT_FRACTION);
  const headlineFontSize = Math.round(height * HERO_HEADLINE_FONT_FRACTION);
  const ctaFontSize = Math.round(height * HERO_CTA_FONT_FRACTION);
  const badgePadding = Math.round(height * HERO_PRICE_BADGE_PADDING_FRACTION);

  const priceGroup = buildHeroPriceBadge(input.priceText, {
    width,
    priceFontSize,
    badgePadding,
  });

  const captionHeight = Math.round(height * HERO_CAPTION_HEIGHT_FRACTION);
  const captionY = height - captionHeight;
  const headlineY = captionY + Math.round(captionHeight * 0.62);

  const headlineLine =
    input.headline !== undefined
      ? `<text x="${String(sidePadding)}" y="${String(headlineY)}" font-family="Arial, sans-serif" font-size="${String(headlineFontSize)}" font-weight="400" fill="#F5F5F5">${escapeXml(truncateForSvg(input.headline, 48))}</text>`
      : "";

  const ctaGroup = buildCtaPill(input.ctaText, {
    width,
    bannerY: captionY,
    bannerHeight: captionHeight,
    sidePadding,
    ctaFontSize,
  });

  const captionRect =
    input.headline !== undefined || input.ctaText !== undefined
      ? `<rect x="0" y="${String(captionY)}" width="${String(width)}" height="${String(captionHeight)}" fill="#000000" fill-opacity="${String(HERO_CAPTION_OPACITY)}" />`
      : "";

  const labelGroup = buildLabelBadge(input.label, { width, height });

  return (
    `<svg width="${String(width)}" height="${String(height)}" xmlns="http://www.w3.org/2000/svg">` +
    `${captionRect}${priceGroup}${headlineLine}${ctaGroup}${labelGroup}` +
    `</svg>`
  );
}

/**
 * `HERO_FULL_BLEED`'s own compact price badge — deliberately TOP-RIGHT (never top-left, which
 * `buildLabelBadge`'s ILUSTRASI disclosure already independently owns) and visually distinct from
 * `buildBottomInfoBarSvg`'s plain top-left price text: a real rounded, semi-transparent badge, not
 * a full-width banner line.
 */
function buildHeroPriceBadge(
  priceText: string | undefined,
  layout: { readonly width: number; readonly priceFontSize: number; readonly badgePadding: number },
): string {
  if (priceText === undefined) {
    return "";
  }
  const text = truncateForSvg(priceText, 20);
  const badgeWidth =
    Math.round(layout.priceFontSize * text.length * 0.62) + layout.priceFontSize * 2;
  const badgeHeight = Math.round(layout.priceFontSize * 1.9);
  const badgeX = layout.width - layout.badgePadding - badgeWidth;
  const badgeY = layout.badgePadding;
  const textX = badgeX + badgeWidth / 2;
  const textY = badgeY + badgeHeight / 2 + layout.priceFontSize * 0.35;

  return (
    `<rect x="${String(badgeX)}" y="${String(badgeY)}" width="${String(badgeWidth)}" height="${String(badgeHeight)}" rx="${String(Math.round(badgeHeight * 0.2))}" fill="#000000" fill-opacity="${String(HERO_PRICE_BADGE_OPACITY)}" />` +
    `<text x="${String(textX)}" y="${String(textY)}" font-family="Arial, sans-serif" font-size="${String(layout.priceFontSize)}" font-weight="700" fill="#FFFFFF" text-anchor="middle">${escapeXml(text)}</text>`
  );
}

/**
 * PROMPT 46 — PROPERTY INTEGRITY MODES. A small, fixed top-left corner badge carrying the real
 * "ILUSTRASI" disclosure text, entirely independent of the bottom price/headline/CTA banner above
 * (a CONCEPTUAL listing may have neither price nor headline/CTA text and still needs this badge —
 * see `buildOverlayContext`'s own doc in `creative-packages.service.ts` for how the two are kept
 * independent). Deliberately positioned opposite the bottom banner so the two never overlap or
 * compete for the same corner regardless of aspect ratio.
 */
function buildLabelBadge(
  label: string | undefined,
  layout: { readonly width: number; readonly height: number },
): string {
  if (label === undefined) {
    return "";
  }
  const fontSize = Math.round(layout.height * LABEL_FONT_FRACTION);
  const padding = Math.round(layout.height * LABEL_PADDING_FRACTION);
  const text = truncateForSvg(label, 24);
  const badgeWidth = Math.min(
    layout.width - padding * 2,
    Math.round(fontSize * text.length * 0.62) + fontSize * 2,
  );
  const badgeHeight = Math.round(fontSize * 1.9);
  const badgeX = padding;
  const badgeY = padding;
  const textX = badgeX + badgeWidth / 2;
  const textY = badgeY + badgeHeight / 2 + fontSize * 0.35;

  return (
    `<rect x="${String(badgeX)}" y="${String(badgeY)}" width="${String(badgeWidth)}" height="${String(badgeHeight)}" rx="${String(Math.round(badgeHeight * 0.15))}" fill="#000000" fill-opacity="${String(LABEL_OPACITY)}" />` +
    `<text x="${String(textX)}" y="${String(textY)}" font-family="Arial, sans-serif" font-size="${String(fontSize)}" font-weight="700" fill="#FFFFFF" text-anchor="middle">${escapeXml(text)}</text>`
  );
}

function buildCtaPill(
  ctaText: string | undefined,
  layout: {
    readonly width: number;
    readonly bannerY: number;
    readonly bannerHeight: number;
    readonly sidePadding: number;
    readonly ctaFontSize: number;
  },
): string {
  if (ctaText === undefined) {
    return "";
  }
  const label = truncateForSvg(ctaText, 24);
  const pillWidth = Math.min(
    layout.width - layout.sidePadding * 2,
    Math.round(layout.ctaFontSize * label.length * 0.62) + layout.ctaFontSize * 2,
  );
  const pillHeight = Math.round(layout.ctaFontSize * 2.1);
  const pillX = layout.width - layout.sidePadding - pillWidth;
  const pillY =
    layout.bannerY + layout.bannerHeight - pillHeight - Math.round(layout.bannerHeight * 0.14);
  const textX = pillX + pillWidth / 2;
  const textY = pillY + pillHeight / 2 + layout.ctaFontSize * 0.35;

  return (
    `<rect x="${String(pillX)}" y="${String(pillY)}" width="${String(pillWidth)}" height="${String(pillHeight)}" rx="${String(Math.round(pillHeight / 2))}" fill="#1E6FD9" />` +
    `<text x="${String(textX)}" y="${String(textY)}" font-family="Arial, sans-serif" font-size="${String(layout.ctaFontSize)}" font-weight="700" fill="#FFFFFF" text-anchor="middle">${escapeXml(label)}</text>`
  );
}

function truncateForSvg(value: string, maxLength: number): string {
  return value.length > maxLength ? `${value.slice(0, maxLength - 1)}…` : value;
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}
