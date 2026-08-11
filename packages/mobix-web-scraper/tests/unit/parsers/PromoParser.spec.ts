import { describe, expect, it } from "vitest";

import { PromoParser } from "../../../src/infrastructure/parsers/PromoParser.js";

const clock = () => new Date("2026-08-07T00:00:00.000Z");

const PROMO_HTML = `
<html><body>
<div class="promo-grid">
  <section class="promo-card">
    <h3 class="promo-card__title">DP Ringan Mulai 10 Juta</h3>
    <p class="promo-card__desc">Simulasi kredit transparan, tanpa biaya tersembunyi</p>
    <span class="promo-card__valid-until">2026-08-31</span>
    <span class="promo-card__applies-to">Xpander,Brio</span>
  </section>
  <section class="promo-card">
    <h3 class="promo-card__title">Kredit Syariah Available</h3>
    <p class="promo-card__desc">Pembiayaan syariah, bebas riba</p>
  </section>
</div>
</body></html>
`;

describe("PromoParser", () => {
  it("parses two promo cards", () => {
    const result = PromoParser.parse(PROMO_HTML, clock);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value).toHaveLength(2);
  });

  it("extracts title, description, validUntil, appliesTo for the first card", () => {
    const result = PromoParser.parse(PROMO_HTML, clock);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const promo = result.value[0]!;
    expect(promo.title).toBe("DP Ringan Mulai 10 Juta");
    expect(promo.description).toContain("kredit transparan");
    expect(promo.validUntil?.toISOString().slice(0, 10)).toBe("2026-08-31");
    expect(promo.appliesTo).toEqual(["Xpander", "Brio"]);
  });

  it("second card has no validUntil/appliesTo (unrestricted, always-active)", () => {
    const result = PromoParser.parse(PROMO_HTML, clock);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const promo = result.value[1]!;
    expect(promo.validUntil).toBeUndefined();
    expect(promo.appliesTo).toBeUndefined();
    expect(promo.appliesToUnit("Avanza")).toBe(true);
  });

  it("rejects empty HTML", () => {
    expect(PromoParser.parse("", clock).ok).toBe(false);
  });

  it("rejects HTML with no promo-card blocks", () => {
    expect(PromoParser.parse("<html><body>nothing</body></html>", clock).ok).toBe(false);
  });

  it("rejects a card missing required fields", () => {
    const broken = `<section class="promo-card"><p class="promo-card__desc">only desc</p></section>`;
    expect(PromoParser.parse(broken, clock).ok).toBe(false);
  });

  it("rejects a promo-card with a whitespace-only title", () => {
    const broken = `<section class="promo-card">
      <h3 class="promo-card__title">   </h3>
      <p class="promo-card__desc">d</p>
    </section>`;
    expect(PromoParser.parse(broken, clock).ok).toBe(false);
  });

  it("rejects an unparseable valid-until date", () => {
    const broken = `<section class="promo-card">
      <h3 class="promo-card__title">Promo</h3>
      <p class="promo-card__desc">d</p>
      <span class="promo-card__valid-until">not-a-date</span>
    </section>`;
    expect(PromoParser.parse(broken, clock).ok).toBe(false);
  });

  it("uses the real-time default clock when none is injected", () => {
    const result = PromoParser.parse(PROMO_HTML);
    expect(result.ok).toBe(true);
  });
});
