import { err, ok, type Result } from "@aos/common";
import { ValidationError } from "@aos/errors";
import { Branch } from "@aos/meta-ads-connector";

/**
 * Case-insensitive alias table mapping raw source strings to the real `@aos/meta-ads-connector`
 * `Branch` enum (`CINERE | BINTARO | BANDUNG | BOOST | MULTI | UMUM` — no `PONDOK_BAMBU` member).
 *
 * Judgment call (documented in the engineering report — the `Branch.PONDOK_BAMBU` note, same
 * resolution `@aos/whatsapp-connector` and its Samantha-supplement predecessor already applied):
 * "Pondok Bambu" is DSS Motor's real-world branch name for what the real enum calls `UMUM`. The
 * spec's own literal `MOCK_UNITS` array already uses `branch: "Umum"` for those units, so this
 * alias exists purely as defensive robustness for a future real adapter whose raw sheet/DMS data
 * might say "Pondok Bambu" literally — it is not exercised by the mock data path.
 */
const BRANCH_ALIASES: Readonly<Record<string, Branch>> = {
  CINERE: Branch.CINERE,
  BINTARO: Branch.BINTARO,
  BANDUNG: Branch.BANDUNG,
  BOOST: Branch.BOOST,
  MULTI: Branch.MULTI,
  UMUM: Branch.UMUM,
  "PONDOK BAMBU": Branch.UMUM,
  JABODETABEK: Branch.JABODETABEK,
};

/** Detects/normalizes a raw source branch string (e.g. a `RawInventoryUnit.branch`) into the real `Branch` enum. */
export function detectBranch(raw: string): Result<Branch, ValidationError> {
  if (typeof raw !== "string" || raw.trim().length === 0) {
    return err(
      new ValidationError(`branch must be a non-empty string, received: ${JSON.stringify(raw)}`),
    );
  }
  const normalized = raw.trim().toUpperCase();
  const branch = BRANCH_ALIASES[normalized];
  if (branch === undefined) {
    return err(new ValidationError(`Unrecognized branch: "${raw}"`));
  }
  return ok(branch);
}
