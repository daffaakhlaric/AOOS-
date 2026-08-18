import "reflect-metadata";

import { err, ok } from "@aos/common";
import { ApiServerError, type MetaAdsConnector } from "@aos/meta-ads-connector";
import { describe, expect, it, vi } from "vitest";

import { createFakeSupabaseClient } from "../../test-support/fake-supabase-client.js";
import { buildTestConfig } from "../../test-support/fixtures.js";

import { CURATED_INTEREST_SEARCH_TERMS } from "./dto/sync-interests.dto.js";
import { MetaInterestRepository } from "./infrastructure/meta-interest.repository.js";
import { MetaInterestsService } from "./meta-interests.service.js";

/** Verbatim from real live Meta `GET /search?type=adinterest` responses, 2026-08-18. */
const USED_CAR = {
  id: "6003257869482",
  name: "Used car (vehicle)",
  audienceSizeLower: 61362891,
  audienceSizeUpper: 72162760,
  path: ["Interests", "Additional interests", "Used car (vehicle)"],
  topic: "Business and industry",
  searchTerm: "used car",
};

const AUTOMOTIVE = {
  id: "6003304550260",
  name: "Automotive industry (industry)",
  audienceSizeLower: 386766403,
  audienceSizeUpper: 454837290,
  path: ["Interests", "Additional interests", "Automotive industry (industry)"],
  topic: "Hobbies and activities",
  searchTerm: "automotive",
};

function buildConnector(
  execute: ReturnType<typeof vi.fn> = vi.fn(async () => ok([USED_CAR])),
): MetaAdsConnector {
  return { searchAdInterests: { execute } } as unknown as MetaAdsConnector;
}

function buildService(connector: MetaAdsConnector) {
  const client = createFakeSupabaseClient();
  const repository = new MetaInterestRepository(client);
  const service = new MetaInterestsService(buildTestConfig(), connector, repository);
  return { service, client, repository };
}

const NOW = new Date("2026-08-18T09:00:00.000Z");

describe("MetaInterestsService.sync", () => {
  it("runs the curated confirmed-live term list when the body supplies none", async () => {
    const execute = vi.fn(async () => ok([USED_CAR]));
    const { service } = buildService(buildConnector(execute));

    const response = await service.sync({}, NOW);

    expect(execute).toHaveBeenCalledTimes(CURATED_INTEREST_SEARCH_TERMS.length);
    expect(response.terms.map((t) => t.term)).toEqual([...CURATED_INTEREST_SEARCH_TERMS]);
    expect(execute).toHaveBeenCalledWith(
      expect.objectContaining({ term: "automotive", accessToken: expect.any(String) }),
    );
  });

  it("persists the REAL returned interests verbatim, stamped with one shared fetchedAt", async () => {
    const { service, client } = buildService(
      buildConnector(vi.fn(async () => ok([USED_CAR, AUTOMOTIVE]))),
    );

    const response = await service.sync({ terms: ["used car"] }, NOW);

    expect(response.totalInserted).toBe(2);
    expect(response.totalUpdated).toBe(0);
    expect(response.fetchedAt).toBe(NOW.toISOString());
    const rows = client.rows("meta_interests");
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({
      id: "6003257869482",
      audience_size_lower: 61362891,
      audience_size_upper: 72162760,
      fetched_at: NOW.toISOString(),
    });
  });

  it("re-running the same sync updates in place rather than duplicating rows", async () => {
    const { service, client } = buildService(buildConnector());

    await service.sync({ terms: ["used car"] }, NOW);
    const second = await service.sync({ terms: ["used car"] }, NOW);

    expect(client.rows("meta_interests")).toHaveLength(1);
    expect(second.totalInserted).toBe(0);
    expect(second.totalUpdated).toBe(1);
  });

  it("reports a failed term honestly and still persists the terms that succeeded", async () => {
    const execute = vi
      .fn()
      .mockResolvedValueOnce(err(new ApiServerError("Meta is down")))
      .mockResolvedValueOnce(ok([AUTOMOTIVE]));
    const { service, client } = buildService(buildConnector(execute));

    const response = await service.sync({ terms: ["used car", "automotive"] }, NOW);

    expect(response.terms[0]).toMatchObject({ term: "used car", ok: false, inserted: 0 });
    expect(response.terms[0]?.error).toContain("Meta is down");
    expect(response.terms[1]).toMatchObject({ term: "automotive", ok: true, inserted: 1 });
    expect(client.rows("meta_interests")).toHaveLength(1);
    expect(response.totalInserted).toBe(1);
  });

  it("forwards an explicit limitPerTerm to the real use case", async () => {
    const execute = vi.fn(async () => ok([USED_CAR]));
    const { service } = buildService(buildConnector(execute));

    await service.sync({ terms: ["used car"], limitPerTerm: 3 }, NOW);

    expect(execute).toHaveBeenCalledWith(expect.objectContaining({ limit: 3 }));
  });

  it("omits limit entirely when none was requested, so the use case's own default applies", async () => {
    const execute = vi.fn(async () => ok([USED_CAR]));
    const { service } = buildService(buildConnector(execute));

    await service.sync({ terms: ["used car"] }, NOW);

    expect(execute).toHaveBeenCalledWith(expect.not.objectContaining({ limit: expect.anything() }));
  });
});

describe("MetaInterestsService.list", () => {
  it("returns the stored catalogue for the configured tenant", async () => {
    const { service } = buildService(buildConnector());
    await service.sync({ terms: ["used car"] }, NOW);

    const listed = await service.list();

    expect(listed).toEqual([
      {
        id: "6003257869482",
        name: "Used car (vehicle)",
        audienceSizeLower: 61362891,
        audienceSizeUpper: 72162760,
        path: ["Interests", "Additional interests", "Used car (vehicle)"],
        topic: "Business and industry",
        searchTerm: "used car",
        fetchedAt: NOW.toISOString(),
      },
    ]);
  });

  it("returns an empty list — never a fabricated seed — before any sync has run", async () => {
    const { service } = buildService(buildConnector());
    expect(await service.list()).toEqual([]);
  });
});
