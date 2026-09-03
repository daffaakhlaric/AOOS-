import { UnavailableError } from "@aos/errors";

import type { RegionOptionDto } from "../dto/region.dto.js";

/**
 * Real, free, public Indonesian administrative-region catalog — confirmed live via direct `curl`
 * during design (`docs/PROMPT-AAOS-GEO-TARGETING-AND-REGION-PICKER.md` Part B) and re-verified
 * directly before writing this file:
 *   - `GET {BASE}/provinsi.json` -> `[{id, nama, latitude, longitude}]`
 *   - `GET {BASE}/kabupaten/{provinceId}.json` -> same shape, that province's regencies/cities
 *   - `GET {BASE}/kecamatan/{kabupatenId}.json` -> same shape, that regency's districts
 * No API key, static JSON on GitHub Pages. Exact same standalone-function-over-global-`fetch`
 * shape `waba-connection-tester.ts`/`aaos-simulator-client.ts` already establish for this
 * codebase's outbound-HTTP calls (no axios/got anywhere).
 */
const WILAYAH_BASE_URL = "https://ibnux.github.io/data-indonesia";

interface RawRegionEntry {
  readonly id: string;
  readonly nama: string;
  readonly latitude?: number;
  readonly longitude?: number;
}

function toOption(entry: RawRegionEntry): RegionOptionDto {
  return { id: entry.id, nama: entry.nama };
}

/**
 * Real, honest degrade: any network failure, non-2xx response, or unparseable/malformed body
 * throws `UnavailableError` — NEVER a fabricated static fallback list, same "never fabricate
 * data" discipline this codebase already follows everywhere else (see `RegionService`'s class
 * doc for how the controller surfaces this).
 */
async function fetchRegionList(url: string, label: string): Promise<readonly RegionOptionDto[]> {
  let response: Response;
  try {
    response = await fetch(url);
  } catch (caught) {
    throw new UnavailableError(
      `Gagal menghubungi data wilayah (${label}): ${caught instanceof Error ? caught.message : String(caught)}`,
    );
  }
  if (!response.ok) {
    throw new UnavailableError(
      `Data wilayah (${label}) tidak tersedia — status ${String(response.status)}`,
    );
  }
  let body: unknown;
  try {
    body = await response.json();
  } catch {
    throw new UnavailableError(`Data wilayah (${label}) mengembalikan respons yang tidak valid`);
  }
  if (!Array.isArray(body)) {
    throw new UnavailableError(`Data wilayah (${label}) mengembalikan bentuk yang tidak dikenal`);
  }
  return (body as RawRegionEntry[]).map(toOption);
}

export function fetchProvinces(): Promise<readonly RegionOptionDto[]> {
  return fetchRegionList(`${WILAYAH_BASE_URL}/provinsi.json`, "provinsi");
}

export function fetchRegencies(provinceId: string): Promise<readonly RegionOptionDto[]> {
  return fetchRegionList(
    `${WILAYAH_BASE_URL}/kabupaten/${encodeURIComponent(provinceId)}.json`,
    "kabupaten/kota",
  );
}

export function fetchDistricts(regencyId: string): Promise<readonly RegionOptionDto[]> {
  return fetchRegionList(
    `${WILAYAH_BASE_URL}/kecamatan/${encodeURIComponent(regencyId)}.json`,
    "kecamatan",
  );
}
