import { Branch } from "@aos/meta-ads-connector";
import { describe, expect, it } from "vitest";

import { DailyDigestBuilder } from "../../../src/builders/DailyDigestBuilder.js";
import { AgentMemory } from "../../../src/domain/entities/AgentMemory.js";
import { ExecutionPlan } from "../../../src/domain/entities/ExecutionPlan.js";
import { ExecutionPlanId } from "../../../src/domain/value-objects/ExecutionPlanId.js";
import { buildScrapedPromo, buildScrapedUnit } from "../../fixtures/mobixFixtures.js";
import { buildObjectiveProgressFixture } from "../../fixtures/objectiveFixtures.js";
import { unwrap } from "../../helpers/result.js";

const now = new Date("2026-08-09T00:00:00.000Z");

function emptyPlan(): ExecutionPlan {
  return unwrap(
    ExecutionPlan.create({
      id: ExecutionPlanId.generate(),
      tenantId: "dss-motor",
      decisions: [],
      generatedAt: now,
    }),
  );
}

function buildDigestWith(memory?: AgentMemory) {
  return DailyDigestBuilder.build({
    tenantId: "dss-motor",
    date: now,
    targetHotLeads: 50,
    budgetAllocationIDR: 30_000_000,
    progress: buildObjectiveProgressFixture(),
    plan: emptyPlan(),
    creativeBriefs: [],
    escalations: [],
    adFindings: [],
    memory,
  });
}

describe("DailyDigestBuilder.build — S2 inventory + promo section", () => {
  it("omits the stock section entirely when no memory is supplied (W1D-base callers)", () => {
    const result = buildDigestWith();
    expect(result.ok && result.value.text).not.toContain("Status Stok");
  });

  it("includes real stock counts and model names grouped by branch, in Indonesian", () => {
    const memory = new AgentMemory();
    memory.seedInventory(
      [
        buildScrapedUnit({ model: "Xpander", priceIDR: 195_000_000, branch: Branch.BINTARO }),
        buildScrapedUnit({
          model: "Xpander",
          priceIDR: 200_000_000,
          branch: Branch.BINTARO,
          slug: "x2",
        }),
        buildScrapedUnit({
          model: "Xpander",
          priceIDR: 210_000_000,
          branch: Branch.BINTARO,
          slug: "x3",
        }),
        buildScrapedUnit({
          model: "Xpander",
          priceIDR: 205_000_000,
          branch: Branch.CINERE,
          slug: "x4",
        }),
        buildScrapedUnit({
          model: "Xpander",
          priceIDR: 199_000_000,
          branch: Branch.CINERE,
          slug: "x5",
        }),
      ],
      now,
    );
    const result = buildDigestWith(memory);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.value.text).toContain("📦 Status Stok");
    expect(result.value.text).toContain("Xpander : 5 unit");
    expect(result.value.text).toContain(`${Branch.BINTARO} 3`);
    expect(result.value.text).toContain(`${Branch.CINERE} 2`);
  });

  it("flags a TOP_UNITS model+branch combination with zero units as out-of-stock", () => {
    const memory = new AgentMemory();
    // Stargazer normally sells at CINERE + BANDUNG (see BusinessKnowledgeBase.TOP_UNITS) — seed
    // stock at CINERE only, so BANDUNG should be flagged as out-of-stock.
    memory.seedInventory(
      [buildScrapedUnit({ model: "Stargazer", priceIDR: 250_000_000, branch: Branch.CINERE })],
      now,
    );
    const result = buildDigestWith(memory);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.text).toContain(
      `⚠️ Stargazer ${Branch.BANDUNG} : stok habis — campaign di-pause otomatis`,
    );
    expect(result.value.text).not.toContain(`⚠️ Stargazer ${Branch.CINERE} :`);
  });

  it("lists active promos with title and validUntil date in Indonesian", () => {
    const memory = new AgentMemory();
    memory.seedPromos([
      buildScrapedPromo({
        title: "DP Ringan mulai 10 juta",
        validUntil: new Date("2026-08-31T00:00:00.000Z"),
      }),
    ]);
    const result = buildDigestWith(memory);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.text).toContain("🎁 Promo Aktif");
    expect(result.value.text).toContain("DP Ringan mulai 10 juta");
    expect(result.value.text).toContain("Agustus 2026");
  });

  it("shows a no-promo placeholder line when activePromos is empty", () => {
    const memory = new AgentMemory();
    const result = buildDigestWith(memory);
    expect(result.ok && result.value.text).toContain("Tidak ada promo aktif saat ini");
  });

  it("shows a no-stock-data placeholder line when currentInventory is empty", () => {
    const memory = new AgentMemory();
    const result = buildDigestWith(memory);
    expect(result.ok && result.value.text).toContain("Tidak ada data stok saat ini");
  });

  it("flags out-of-stock for multiple TOP_UNITS models independently", () => {
    const memory = new AgentMemory();
    // Xpander sells at BINTARO + CINERE — seed neither, so both should be flagged.
    memory.seedInventory(
      [buildScrapedUnit({ model: "Brio", priceIDR: 150_000_000, branch: Branch.BINTARO })],
      now,
    );
    const result = buildDigestWith(memory);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.text).toContain(`⚠️ Xpander ${Branch.BINTARO}`);
    expect(result.value.text).toContain(`⚠️ Xpander ${Branch.CINERE}`);
  });

  it("does not flag out-of-stock for a model+branch combination that IS in stock", () => {
    const memory = new AgentMemory();
    memory.seedInventory(
      [
        buildScrapedUnit({ model: "Brio", priceIDR: 150_000_000, branch: Branch.BINTARO }),
        buildScrapedUnit({
          model: "Brio",
          priceIDR: 155_000_000,
          branch: Branch.CINERE,
          slug: "b2",
        }),
        buildScrapedUnit({ model: "Brio", priceIDR: 152_000_000, branch: Branch.UMUM, slug: "b3" }),
      ],
      now,
    );
    const result = buildDigestWith(memory);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.text).not.toContain("⚠️ Brio");
  });

  it("shows a promo without validUntil as 'berlaku tanpa batas waktu'", () => {
    const memory = new AgentMemory();
    memory.seedPromos([buildScrapedPromo({ title: "Promo abadi" })]);
    const result = buildDigestWith(memory);
    expect(result.ok && result.value.text).toContain("Promo abadi (berlaku tanpa batas waktu)");
  });

  it("lists multiple active promos, each on its own bullet line", () => {
    const memory = new AgentMemory();
    memory.seedPromos([
      buildScrapedPromo({ title: "Promo A" }),
      buildScrapedPromo({ title: "Promo B" }),
    ]);
    const result = buildDigestWith(memory);
    expect(result.ok && result.value.text).toContain("• Promo A");
    expect(result.ok && result.value.text).toContain("• Promo B");
  });

  it("digest text without memory is unaffected in every other section", () => {
    const withMemory = buildDigestWith(new AgentMemory());
    const withoutMemory = buildDigestWith();
    expect(withoutMemory.ok && withMemory.ok).toBe(true);
    if (!withMemory.ok || !withoutMemory.ok) return;
    // Everything up to (but not including) the stock/promo section is identical.
    const base = withoutMemory.value.text;
    expect(withMemory.value.text.startsWith(base)).toBe(true);
  });
});
