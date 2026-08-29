import { Branch } from "@aos/meta-ads-connector";

/**
 * DSS Motor's 4 real, physical branches (spec folder tree: `BINTARO | CINERE | PONDOK_BAMBU |
 * BANDUNG`).
 *
 * Judgment call — **third occurrence of this exact resolution in the AAOS series**
 * (`@aos/whatsapp-connector`'s `Branch` value object, then `@aos/dss-inventory-connector`'s
 * `utils/BranchDetector.ts`, now here): the real `@aos/meta-ads-connector` `Branch` enum has no
 * `PONDOK_BAMBU` member (its actual values are `CINERE | BINTARO | BANDUNG | BOOST | MULTI |
 * UMUM`). `BranchId` therefore uses `UMUM` in place of the nonexistent `PONDOK_BAMBU` — the
 * human-readable "Pondok Bambu" name lives in `BranchConfig.displayName` ("Cabang Pondok Bambu")
 * and the env var names (`PHONE_NUMBER_ID_PONDOK_BAMBU` / `PHONE_NUMBER_PONDOK_BAMBU`), not in the
 * enum value itself.
 *
 * `BranchId` is defined as an independently-declared local enum (not a re-export) whose 4 members'
 * *string values* are character-for-character identical to the real `Branch` enum's corresponding
 * 4 members. That makes `BranchId.BINTARO as string === Branch.BINTARO as string` (etc.) true by
 * construction — trivially interoperable wherever a `Branch`-typed value is expected downstream
 * (Samantha, the inventory connector's `Branch`-typed `InventoryUnit.branch` field), without taking
 * a structural/type-level dependency that would let `Branch.BOOST`, `Branch.MULTI`, or
 * `Branch.JABODETABEK` (which have no DSS Motor branch-manager meaning) leak into this package's
 * domain. `toBranch`/`fromBranch` below provide explicit, typed conversion at integration
 * boundaries.
 */
export enum BranchId {
  BINTARO = "BINTARO",
  CINERE = "CINERE",
  UMUM = "UMUM",
  BANDUNG = "BANDUNG",
}

/** Explicit, typed conversion to the real `@aos/meta-ads-connector` `Branch` enum for downstream consumers. */
export function toBranch(id: BranchId): Branch {
  switch (id) {
    case BranchId.BINTARO:
      return Branch.BINTARO;
    case BranchId.CINERE:
      return Branch.CINERE;
    case BranchId.UMUM:
      return Branch.UMUM;
    case BranchId.BANDUNG:
      return Branch.BANDUNG;
  }
}

/** Explicit, typed conversion from the real `Branch` enum, for the 4 members `BranchId` covers. `undefined` for `BOOST | MULTI | JABODETABEK`, which have no DSS Motor branch-manager meaning. */
export function fromBranch(branch: Branch): BranchId | undefined {
  switch (branch) {
    case Branch.BINTARO:
      return BranchId.BINTARO;
    case Branch.CINERE:
      return BranchId.CINERE;
    case Branch.UMUM:
      return BranchId.UMUM;
    case Branch.BANDUNG:
      return BranchId.BANDUNG;
    default:
      return undefined;
  }
}

/** All 4 `BranchId` members, in the DSS Motor canonical order (matches `DSS_MOTOR_BRANCHES` seed order). */
export const ALL_BRANCH_IDS: readonly BranchId[] = [
  BranchId.BINTARO,
  BranchId.CINERE,
  BranchId.UMUM,
  BranchId.BANDUNG,
];
