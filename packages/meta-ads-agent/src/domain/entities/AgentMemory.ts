import type { AdMetrics, Branch, Funnel } from "@aos/meta-ads-connector";
import type { ScrapedPromo, ScrapedUnit } from "@aos/mobix-web-scraper";

import type { EscalationOutcome } from "../../types/AgentTypes.js";
import type { AdAngle } from "../value-objects/AdAngle.js";
import type { PerformanceBaseline } from "../value-objects/PerformanceBaseline.js";
import type { SeasonalPattern } from "../value-objects/SeasonalPattern.js";

export interface DecisionOutcome {
  readonly decisionId: string;
  readonly actionKind: string;
  readonly rphChatBeforeIDR: number | null;
  readonly rphChatAfterIDR: number | null;
  readonly recordedAt: Date;
}

export interface AnglePerformanceRecord {
  readonly unitBranchKey: string;
  readonly angle: string;
  readonly sampleCount: number;
  readonly avgRphD3IDR: number;
}

/**
 * Samantha's in-memory learning state — a plain `Map`-based accumulator, per spec: "Memory is reset
 * on each `SamanthaAgentFactory.create()` call — no persistence between sessions. Memory
 * accumulates within a session as Samantha runs multiple optimization cycles." Owned by exactly one
 * `SamanthaAgentService` instance (created fresh by `SamanthaAgentFactory.create()`); every mutating
 * method here is defensive and never throws, matching the package's zero-throw discipline even
 * though this class does not itself perform business-rule validation (it is a pure accumulator,
 * not a Value Object).
 */
/** New unit detected between two `ScrapeSession`s — the shape `AgentMemory.newUnitsDetected` and `VerdictDecisionEngine`'s new-unit escalation consume (AAOS-W1D-S1S2, S2). */
export interface NewUnitAlert {
  readonly model: string;
  readonly year: number;
  readonly branch: Branch;
}

export class AgentMemory {
  private readonly _decisionOutcomes = new Map<string, DecisionOutcome>();
  private readonly _anglePerformance = new Map<string, AnglePerformanceRecord>();
  private readonly _timePerformance = new Map<number, number>();
  private readonly _campaignHistory = new Map<string, AdMetrics[]>();
  private readonly _escalationOutcomes = new Map<string, EscalationOutcome>();

  // ── AAOS-W1D-S1S2 (S1): Historical Learning fields ──
  private readonly _performanceBaselines = new Map<string, PerformanceBaseline>();
  private readonly _evergreenAds = new Set<string>();
  private _fatiguePatterns: ReadonlyMap<Funnel, number> = new Map();
  private _seasonalPatterns: SeasonalPattern = new Map();
  private _topAngles: AdAngle[] = [];
  private _historicalLearned = false;

  // ── AAOS-W1D-S1S2 (S2): Inventory + Promo fields ──
  private _currentInventory: ScrapedUnit[] = [];
  private _activePromos: ScrapedPromo[] = [];
  private _lastInventoryScrapeAt: Date | undefined;
  private _inventoryLoaded = false;
  private _newUnitsDetected: NewUnitAlert[] = [];

  get decisionOutcomes(): ReadonlyMap<string, DecisionOutcome> {
    return this._decisionOutcomes;
  }

  get anglePerformance(): ReadonlyMap<string, AnglePerformanceRecord> {
    return this._anglePerformance;
  }

  get timePerformance(): ReadonlyMap<number, number> {
    return this._timePerformance;
  }

  get campaignHistory(): ReadonlyMap<string, ReadonlyArray<AdMetrics>> {
    return this._campaignHistory;
  }

  get escalationOutcomes(): ReadonlyMap<string, EscalationOutcome> {
    return this._escalationOutcomes;
  }

  recordDecisionOutcome(outcome: DecisionOutcome): void {
    this._decisionOutcomes.set(outcome.decisionId, outcome);
  }

  recordAnglePerformance(record: AnglePerformanceRecord): void {
    const key = `${record.unitBranchKey}::${record.angle}`;
    this._anglePerformance.set(key, record);
  }

  recordTimePerformance(hour: number, avgRphD3IDR: number): void {
    this._timePerformance.set(hour, avgRphD3IDR);
  }

  appendCampaignHistory(adId: string, metrics: AdMetrics): void {
    const existing = this._campaignHistory.get(adId) ?? [];
    existing.push(metrics);
    this._campaignHistory.set(adId, existing);
  }

  recordEscalationOutcome(decisionId: string, outcome: EscalationOutcome): void {
    this._escalationOutcomes.set(decisionId, outcome);
  }

  /** Total number of cycles' worth of decision outcomes recorded so far — used by tests to assert accumulation. */
  get decisionOutcomeCount(): number {
    return this._decisionOutcomes.size;
  }

  // ═══════════════════════════════════════════════════════════════════════════════════
  // AAOS-W1D-S1S2 (S1) — Historical Learning accessors + mutators
  // ═══════════════════════════════════════════════════════════════════════════════════

  /** Keyed `${branch}-${funnel}-${angle}` — see `PerformanceBaseline`'s `performanceBaselineKey()`. */
  get performanceBaselines(): ReadonlyMap<string, PerformanceBaseline> {
    return this._performanceBaselines;
  }

  /** `Ad.id`s (as strings) `HistoricalLearningService.learn()` classified as evergreen (active > 60 days, still healthy). */
  get evergreenAds(): ReadonlySet<string> {
    return this._evergreenAds;
  }

  get fatiguePatterns(): ReadonlyMap<Funnel, number> {
    return this._fatiguePatterns;
  }

  get seasonalPatterns(): SeasonalPattern {
    return this._seasonalPatterns;
  }

  /** Ranked ascending by historical Rp/D3 (best first). */
  get topAngles(): ReadonlyArray<AdAngle> {
    return this._topAngles;
  }

  get historicalLearned(): boolean {
    return this._historicalLearned;
  }

  seedPerformanceBaseline(key: string, baseline: PerformanceBaseline): void {
    this._performanceBaselines.set(key, baseline);
  }

  markEvergreen(adId: string): void {
    this._evergreenAds.add(adId);
  }

  seedHistoricalLearnings(input: {
    readonly performanceBaselines: ReadonlyMap<string, PerformanceBaseline>;
    readonly evergreenAdIds: ReadonlyArray<string>;
    readonly fatiguePatterns: ReadonlyMap<Funnel, number>;
    readonly seasonalPatterns: SeasonalPattern;
    readonly topAngles: ReadonlyArray<AdAngle>;
  }): void {
    for (const [key, baseline] of input.performanceBaselines) {
      this._performanceBaselines.set(key, baseline);
    }
    for (const adId of input.evergreenAdIds) {
      this._evergreenAds.add(adId);
    }
    this._fatiguePatterns = input.fatiguePatterns;
    this._seasonalPatterns = input.seasonalPatterns;
    this._topAngles = [...input.topAngles];
    this._historicalLearned = true;
  }

  // ═══════════════════════════════════════════════════════════════════════════════════
  // AAOS-W1D-S1S2 (S2) — Mobix Inventory + Promo accessors + mutators
  // ═══════════════════════════════════════════════════════════════════════════════════

  get currentInventory(): ReadonlyArray<ScrapedUnit> {
    return this._currentInventory;
  }

  /** Derived on every read from `currentInventory` — never independently mutated, so it can never drift out of sync. */
  get inventoryByBranch(): ReadonlyMap<Branch, ReadonlyArray<ScrapedUnit>> {
    const map = new Map<Branch, ScrapedUnit[]>();
    for (const unit of this._currentInventory) {
      const existing = map.get(unit.branch) ?? [];
      existing.push(unit);
      map.set(unit.branch, existing);
    }
    return map;
  }

  /** Keyed by `ScrapedUnit.model`, case-sensitive exact match — derived on every read, same rationale as `inventoryByBranch`. */
  get inventoryByModel(): ReadonlyMap<string, ReadonlyArray<ScrapedUnit>> {
    const map = new Map<string, ScrapedUnit[]>();
    for (const unit of this._currentInventory) {
      const existing = map.get(unit.model) ?? [];
      existing.push(unit);
      map.set(unit.model, existing);
    }
    return map;
  }

  get activePromos(): ReadonlyArray<ScrapedPromo> {
    return this._activePromos;
  }

  get lastInventoryScrapeAt(): Date | undefined {
    return this._lastInventoryScrapeAt;
  }

  get inventoryLoaded(): boolean {
    return this._inventoryLoaded;
  }

  get newUnitsDetected(): ReadonlyArray<NewUnitAlert> {
    return this._newUnitsDetected;
  }

  seedInventory(units: ReadonlyArray<ScrapedUnit>, scrapedAt: Date): void {
    this._currentInventory = [...units];
    this._lastInventoryScrapeAt = scrapedAt;
    this._inventoryLoaded = true;
  }

  seedPromos(promos: ReadonlyArray<ScrapedPromo>): void {
    this._activePromos = [...promos];
  }

  seedNewUnitsDetected(units: ReadonlyArray<NewUnitAlert>): void {
    this._newUnitsDetected = [...units];
  }
}
