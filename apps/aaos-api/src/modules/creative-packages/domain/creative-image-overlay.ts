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
 * NOT a dynamic layout engine (`PROMPT 58`, a future phase) — no layout-family selection, no
 * per-angle/per-format recomposition. `imageAspectRatio`-aware positioning is intentionally NOT
 * attempted here; the banner is sized as a fraction of the actual image height/width sharp reports
 * for THIS buffer, so it degrades sanely across 1:1/9:16/16:9 without a second code path per ratio.
 *
 * HONEST DEGRADE: every failure mode (sharp not resolving image dimensions, a corrupt buffer, an
 * SVG/library exception) returns `{ ok: false, reason }` — it NEVER throws, and NEVER returns a
 * buffer that silently failed to receive its text. The caller (`CreativePackagesService`) is
 * responsible for falling back to the original, un-composited buffer and logging the honest reason;
 * this module has no opinion on what "good enough" means for the pipeline, only on whether ITS OWN
 * compositing genuinely succeeded.
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
    (input.ctaText === undefined || input.ctaText.length === 0)
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

  return (
    `<svg width="${String(width)}" height="${String(height)}" xmlns="http://www.w3.org/2000/svg">` +
    `<rect x="0" y="${String(bannerY)}" width="${String(width)}" height="${String(bannerHeight)}" fill="#000000" fill-opacity="${String(BANNER_OPACITY)}" />` +
    `${priceLine}${headlineLine}${ctaGroup}` +
    `</svg>`
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
