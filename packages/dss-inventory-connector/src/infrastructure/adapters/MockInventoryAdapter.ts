import { ok, type Result } from "@aos/common";
import type { Branch } from "@aos/meta-ads-connector";

import type {
  AdapterHealth,
  IInventorySourceAdapter,
  RawInventoryUnit,
} from "../../contracts/IInventorySourceAdapter.js";
import type { AdapterError } from "../../domain/errors/index.js";
import { SourcePriority } from "../../domain/value-objects/SourcePriority.js";
import { SourceSystem } from "../../domain/value-objects/SourceSystem.js";
import { detectBranch } from "../../utils/BranchDetector.js";

/**
 * Realistic DSS Motor test data, based on actual units seen in MAAO 2 campaign data — used in all
 * tests and as the fallback source when no real adapter is configured.
 *
 * Judgment call (documented in the engineering report's resolution #1): the spec's own pinned
 * "mock_data_integrity" test claims `total units = 15` / `available = 13, reserved = 1, sold = 1`
 * (sums to 15), while its separately-pinned `by branch` breakdown (`bintaro=4, cinere=5, umum=2,
 * bandung=2`) sums to 13 — and the literal `MOCK_UNITS` array given in the spec's own
 * "MockInventoryAdapter (Full Implementation)" section has exactly 13 entries (4+5+2+2), matching
 * the branch breakdown, not the "15" total. This array is copied verbatim from that literal spec
 * listing (13 entries, not padded to 15) — the "15"/"13 available" lines are treated as
 * documentation typos; see `tests/unit/adapters/MockInventoryAdapter.spec.ts` for the corrected,
 * mathematically-consistent assertions (total=13, available=11, reserved=1, sold=1).
 */
export const MOCK_UNITS: ReadonlyArray<RawInventoryUnit> = [
  // ── Bintaro ──────────────────────────────────────────────
  {
    externalId: "MOCK-BIN-001",
    brand: "Mitsubishi",
    model: "Xpander Cross",
    year: 2019,
    transmission: "AT",
    color: "Putih Pearl",
    kilometer: 45000,
    priceIDR: 195_000_000,
    branch: "Bintaro",
    status: "AVAILABLE",
    photos: [],
    features: ["Panoramic Roof"],
  },
  {
    externalId: "MOCK-BIN-002",
    brand: "Mitsubishi",
    model: "Xpander Exceed",
    year: 2020,
    transmission: "AT",
    color: "Hitam",
    kilometer: 38000,
    priceIDR: 210_000_000,
    branch: "Bintaro",
    status: "AVAILABLE",
    photos: [],
    features: [],
  },
  {
    externalId: "MOCK-BIN-003",
    brand: "Honda",
    model: "Brio RS",
    year: 2021,
    transmission: "AT",
    color: "Merah",
    kilometer: 22000,
    priceIDR: 158_000_000,
    branch: "Bintaro",
    status: "AVAILABLE",
    photos: [],
    features: ["Sunroof"],
  },
  {
    externalId: "MOCK-BIN-004",
    brand: "Toyota",
    model: "Avanza Veloz",
    year: 2018,
    transmission: "AT",
    color: "Silver",
    kilometer: 62000,
    priceIDR: 148_000_000,
    branch: "Bintaro",
    status: "RESERVED",
    photos: [],
    features: [],
  },

  // ── Cinere ───────────────────────────────────────────────
  {
    externalId: "MOCK-CIN-001",
    brand: "Mitsubishi",
    model: "Xpander Cross",
    year: 2020,
    transmission: "AT",
    color: "Putih Pearl",
    kilometer: 31000,
    priceIDR: 215_000_000,
    branch: "Cinere",
    status: "AVAILABLE",
    photos: [],
    features: ["Panoramic Roof"],
  },
  {
    externalId: "MOCK-CIN-002",
    brand: "Mitsubishi",
    model: "Xpander Ultimate",
    year: 2021,
    transmission: "AT",
    color: "Abu Metalik",
    kilometer: 28000,
    priceIDR: 238_000_000,
    branch: "Cinere",
    status: "AVAILABLE",
    photos: [],
    features: ["360 Camera"],
  },
  {
    externalId: "MOCK-CIN-003",
    brand: "Toyota",
    model: "Raize GR Sport",
    year: 2022,
    transmission: "AT",
    color: "Merah",
    kilometer: 18000,
    priceIDR: 248_000_000,
    branch: "Cinere",
    status: "AVAILABLE",
    photos: [],
    features: ["Turbo"],
  },
  {
    externalId: "MOCK-CIN-004",
    brand: "Honda",
    model: "Brio Satya",
    year: 2020,
    transmission: "MT",
    color: "Putih",
    kilometer: 35000,
    priceIDR: 118_000_000,
    branch: "Cinere",
    status: "AVAILABLE",
    photos: [],
    features: [],
  },
  {
    externalId: "MOCK-CIN-005",
    brand: "Toyota",
    model: "Rush G",
    year: 2019,
    transmission: "AT",
    color: "Hitam",
    kilometer: 55000,
    priceIDR: 225_000_000,
    branch: "Cinere",
    status: "AVAILABLE",
    photos: [],
    features: ["7 Seater"],
  },

  // ── Pondok Bambu (maps to Branch.UMUM — see utils/BranchDetector.ts) ────────
  {
    externalId: "MOCK-PON-001",
    brand: "Honda",
    model: "Brio RS",
    year: 2020,
    transmission: "AT",
    color: "Biru",
    kilometer: 29000,
    priceIDR: 148_000_000,
    branch: "Umum",
    status: "AVAILABLE",
    photos: [],
    features: [],
  },
  {
    externalId: "MOCK-PON-002",
    brand: "Toyota",
    model: "Avanza G",
    year: 2020,
    transmission: "MT",
    color: "Silver",
    kilometer: 41000,
    priceIDR: 155_000_000,
    branch: "Umum",
    status: "AVAILABLE",
    photos: [],
    features: [],
  },

  // ── Bandung ───────────────────────────────────────────────
  {
    externalId: "MOCK-BDG-001",
    brand: "Hyundai",
    model: "Stargazer Essential",
    year: 2023,
    transmission: "MT",
    color: "Putih",
    kilometer: 12000,
    priceIDR: 225_000_000,
    branch: "Bandung",
    status: "AVAILABLE",
    photos: [],
    features: ["7 Seater"],
  },
  {
    externalId: "MOCK-BDG-002",
    brand: "Toyota",
    model: "Avanza G",
    year: 2019,
    transmission: "AT",
    color: "Hitam",
    kilometer: 58000,
    priceIDR: 145_000_000,
    branch: "Bandung",
    status: "SOLD",
    photos: [],
    features: [],
  },
];

/** FULL implementation — realistic, fixed DSS Motor test data. Always configured; always healthy. Used in every test and as the development-mode/HYBRID-fallback source. */
export class MockInventoryAdapter implements IInventorySourceAdapter {
  readonly sourceSystem = SourceSystem.MOCK;
  readonly priority = SourcePriority.MOCK;

  isConfigured(): boolean {
    return true;
  }

  async fetchUnits(): Promise<Result<RawInventoryUnit[], AdapterError>> {
    return Promise.resolve(ok([...MOCK_UNITS]));
  }

  async fetchUnitsByBranch(branch: Branch): Promise<Result<RawInventoryUnit[], AdapterError>> {
    const filtered = MOCK_UNITS.filter((unit) => {
      const detected = detectBranch(unit.branch);
      return detected.ok && detected.value === branch;
    });
    return Promise.resolve(ok([...filtered]));
  }

  async healthCheck(): Promise<Result<AdapterHealth, AdapterError>> {
    return Promise.resolve(
      ok({ healthy: true, latencyMs: 0, message: "MockInventoryAdapter always healthy" }),
    );
  }
}
