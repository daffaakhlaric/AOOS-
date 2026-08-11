import { describe, expect, it } from "vitest";

import { UnitListingParser } from "../../../src/infrastructure/parsers/UnitListingParser.js";

const clock = () => new Date("2026-08-07T00:00:00.000Z");

const LISTING_HTML = `
<html><body>
<div class="listing-grid">
  <article class="unit-card" data-branch="BINTARO" data-available="true">
    <a class="unit-card__link" href="https://mobixbydss.id/unit/xpander-cross-2019-abc123">
      <img src="https://mobixbydss.id/photos/abc123-1.jpg" />
      <img src="https://mobixbydss.id/photos/abc123-2.jpg" />
      <h3 class="unit-card__title">Mitsubishi Xpander Cross 2019</h3>
      <span class="unit-card__price">Rp 195.000.000</span>
      <span class="unit-card__km">45.000 km</span>
      <span class="unit-card__transmission">AT</span>
      <span class="unit-card__color">Putih</span>
    </a>
  </article>
  <article class="unit-card" data-branch="BANDUNG" data-available="false">
    <a class="unit-card__link" href="https://mobixbydss.id/unit/stargazer-2022-xyz789">
      <img src="https://mobixbydss.id/photos/xyz789-1.jpg" />
      <h3 class="unit-card__title">Hyundai Stargazer 2022</h3>
      <span class="unit-card__price">Rp 250.000.000</span>
      <span class="unit-card__km">20 rb km</span>
      <span class="unit-card__transmission">AT</span>
      <span class="unit-card__color">Hitam</span>
    </a>
  </article>
</div>
</body></html>
`;

describe("UnitListingParser", () => {
  it("parses two unit cards from a listing page", () => {
    const result = UnitListingParser.parse(LISTING_HTML, clock);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value).toHaveLength(2);
  });

  it("extracts brand, model, year, price, km correctly for the first card", () => {
    const result = UnitListingParser.parse(LISTING_HTML, clock);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const unit = result.value[0]!;
    expect(unit.brand).toBe("Mitsubishi");
    expect(unit.model).toBe("Xpander Cross");
    expect(unit.year).toBe(2019);
    expect(unit.price.idr).toBe(195_000_000);
    expect(unit.kilometer.km).toBe(45_000);
    expect(unit.transmission).toBe("AT");
    expect(unit.color).toBe("Putih");
    expect(unit.available).toBe(true);
    expect(unit.photos).toHaveLength(2);
  });

  it("marks the second (out-of-stock) unit as unavailable and applies rb-suffix km parsing", () => {
    const result = UnitListingParser.parse(LISTING_HTML, clock);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const unit = result.value[1]!;
    expect(unit.model).toBe("Stargazer");
    expect(unit.available).toBe(false);
    expect(unit.kilometer.km).toBe(20_000);
  });

  it("rejects empty HTML", () => {
    expect(UnitListingParser.parse("", clock).ok).toBe(false);
  });

  it("rejects HTML with no unit-card blocks", () => {
    expect(UnitListingParser.parse("<html><body>no cards here</body></html>", clock).ok).toBe(
      false,
    );
  });

  it("rejects a card missing a required field", () => {
    const broken = `<article class="unit-card" data-branch="CINERE" data-available="true">
      <a class="unit-card__link" href="https://mobixbydss.id/unit/x">
        <h3 class="unit-card__title">Toyota Avanza 2020</h3>
      </a>
    </article>`;
    expect(UnitListingParser.parse(broken, clock).ok).toBe(false);
  });

  it("rejects an unrecognized branch code", () => {
    const broken = `<article class="unit-card" data-branch="SURABAYA" data-available="true">
      <a class="unit-card__link" href="https://mobixbydss.id/unit/x">
        <h3 class="unit-card__title">Toyota Avanza 2020</h3>
        <span class="unit-card__price">Rp 100.000.000</span>
        <span class="unit-card__km">10.000 km</span>
        <span class="unit-card__transmission">AT</span>
        <span class="unit-card__color">Hitam</span>
      </a>
    </article>`;
    expect(UnitListingParser.parse(broken, clock).ok).toBe(false);
  });

  it("rejects a card with an unparseable price", () => {
    const broken = `<article class="unit-card" data-branch="CINERE" data-available="true">
      <a class="unit-card__link" href="https://mobixbydss.id/unit/x">
        <h3 class="unit-card__title">Toyota Avanza 2020</h3>
        <span class="unit-card__price">contact us</span>
        <span class="unit-card__km">10.000 km</span>
        <span class="unit-card__transmission">AT</span>
        <span class="unit-card__color">Hitam</span>
      </a>
    </article>`;
    expect(UnitListingParser.parse(broken, clock).ok).toBe(false);
  });

  it("rejects a card with an unparseable kilometer value", () => {
    const broken = `<article class="unit-card" data-branch="CINERE" data-available="true">
      <a class="unit-card__link" href="https://mobixbydss.id/unit/x">
        <h3 class="unit-card__title">Toyota Avanza 2020</h3>
        <span class="unit-card__price">Rp 100.000.000</span>
        <span class="unit-card__km">unknown km</span>
        <span class="unit-card__transmission">AT</span>
        <span class="unit-card__color">Hitam</span>
      </a>
    </article>`;
    expect(UnitListingParser.parse(broken, clock).ok).toBe(false);
  });

  it("rejects a card with an unrecognized transmission value", () => {
    const broken = `<article class="unit-card" data-branch="CINERE" data-available="true">
      <a class="unit-card__link" href="https://mobixbydss.id/unit/x">
        <h3 class="unit-card__title">Toyota Avanza 2020</h3>
        <span class="unit-card__price">Rp 100.000.000</span>
        <span class="unit-card__km">10.000 km</span>
        <span class="unit-card__transmission">CVT</span>
        <span class="unit-card__color">Hitam</span>
      </a>
    </article>`;
    expect(UnitListingParser.parse(broken, clock).ok).toBe(false);
  });

  it("rejects a card whose title has no year", () => {
    const broken = `<article class="unit-card" data-branch="CINERE" data-available="true">
      <a class="unit-card__link" href="https://mobixbydss.id/unit/x">
        <h3 class="unit-card__title">Toyota Avanza Terbaru</h3>
        <span class="unit-card__price">Rp 100.000.000</span>
        <span class="unit-card__km">10.000 km</span>
        <span class="unit-card__transmission">AT</span>
        <span class="unit-card__color">Hitam</span>
      </a>
    </article>`;
    expect(UnitListingParser.parse(broken, clock).ok).toBe(false);
  });

  it("rejects a card whose title cannot be split into brand/model", () => {
    const broken = `<article class="unit-card" data-branch="CINERE" data-available="true">
      <a class="unit-card__link" href="https://mobixbydss.id/unit/x">
        <h3 class="unit-card__title">Toyota 2020</h3>
        <span class="unit-card__price">Rp 100.000.000</span>
        <span class="unit-card__km">10.000 km</span>
        <span class="unit-card__transmission">AT</span>
        <span class="unit-card__color">Hitam</span>
      </a>
    </article>`;
    expect(UnitListingParser.parse(broken, clock).ok).toBe(false);
  });

  it("rejects a card with an invalid unit URL", () => {
    const broken = `<article class="unit-card" data-branch="CINERE" data-available="true">
      <a class="unit-card__link" href="not-a-url">
        <h3 class="unit-card__title">Toyota Avanza 2020</h3>
        <span class="unit-card__price">Rp 100.000.000</span>
        <span class="unit-card__km">10.000 km</span>
        <span class="unit-card__transmission">AT</span>
        <span class="unit-card__color">Hitam</span>
      </a>
    </article>`;
    expect(UnitListingParser.parse(broken, clock).ok).toBe(false);
  });

  it("uses the real-time default clock when none is injected", () => {
    const result = UnitListingParser.parse(LISTING_HTML);
    expect(result.ok).toBe(true);
  });
});
