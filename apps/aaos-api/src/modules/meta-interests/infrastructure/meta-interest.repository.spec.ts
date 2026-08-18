import { describe, expect, it } from "vitest";

import { createFakeSupabaseClient } from "../../../test-support/fake-supabase-client.js";

import {
  MetaInterestRepository,
  MetaInterestRepositoryError,
  type SaveMetaInterestInput,
} from "./meta-interest.repository.js";

/** Verbatim from a real live Meta `GET /search?type=adinterest&q=used car` response, 2026-08-18. */
const REAL_INPUT: SaveMetaInterestInput = {
  id: "6003257869482",
  tenantId: "dss-motor",
  name: "Used car (vehicle)",
  audienceSizeLower: 61362891,
  audienceSizeUpper: 72162760,
  path: ["Interests", "Additional interests", "Used car (vehicle)"],
  topic: "Business and industry",
  searchTerm: "used car",
};

const FETCHED_AT = "2026-08-18T00:00:00.000Z";

describe("MetaInterestRepository", () => {
  it("save inserts a new row keyed by Meta's own interest id (not a generated UUID)", async () => {
    const client = createFakeSupabaseClient();
    const repo = new MetaInterestRepository(client);

    expect(await repo.save(REAL_INPUT, FETCHED_AT)).toBe("inserted");

    const rows = client.rows("meta_interests");
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      id: "6003257869482",
      tenant_id: "dss-motor",
      name: "Used car (vehicle)",
      audience_size_lower: 61362891,
      audience_size_upper: 72162760,
      search_term: "used car",
      topic: "Business and industry",
      fetched_at: FETCHED_AT,
    });
  });

  it("save is idempotent — a second sync of the same interest updates in place, never duplicates", async () => {
    const client = createFakeSupabaseClient();
    const repo = new MetaInterestRepository(client);
    await repo.save(REAL_INPUT, FETCHED_AT);

    const outcome = await repo.save(
      { ...REAL_INPUT, audienceSizeUpper: 72500000, searchTerm: "vehicle" },
      "2026-09-01T00:00:00.000Z",
    );

    expect(outcome).toBe("updated");
    expect(client.rows("meta_interests")).toHaveLength(1);
    const refreshed = await repo.findById("6003257869482");
    expect(refreshed?.audienceSizeUpper).toBe(72500000);
    expect(refreshed?.searchTerm).toBe("vehicle");
    expect(refreshed?.fetchedAt).toBe("2026-09-01T00:00:00.000Z");
  });

  it("persists a missing topic as NULL and omits it again on read", async () => {
    const client = createFakeSupabaseClient();
    const repo = new MetaInterestRepository(client);
    const { topic: _topic, ...withoutTopic } = REAL_INPUT;

    await repo.save(withoutTopic, FETCHED_AT);

    expect(client.rows("meta_interests")[0]?.topic).toBeNull();
    expect(await repo.findById("6003257869482")).not.toHaveProperty("topic");
  });

  it("findById returns undefined for an unknown id", async () => {
    const repo = new MetaInterestRepository(createFakeSupabaseClient());
    expect(await repo.findById("nope")).toBeUndefined();
  });

  it("listByTenant returns only that tenant's rows, freshest first", async () => {
    const client = createFakeSupabaseClient();
    const repo = new MetaInterestRepository(client);
    await repo.save(REAL_INPUT, "2026-08-01T00:00:00.000Z");
    await repo.save(
      { ...REAL_INPUT, id: "6003739713691", name: "car finance (credit and lending)" },
      "2026-08-18T00:00:00.000Z",
    );
    await repo.save({ ...REAL_INPUT, id: "other", tenantId: "someone-else" }, FETCHED_AT);

    const listed = await repo.listByTenant("dss-motor");
    expect(listed.map((i) => i.id)).toEqual(["6003739713691", "6003257869482"]);
  });

  it("throws MetaInterestRepositoryError on a Supabase error", async () => {
    const client = createFakeSupabaseClient();
    const repo = new MetaInterestRepository(client);
    client.forceErrorOnce("meta_interests", "db down");
    await expect(repo.save(REAL_INPUT, FETCHED_AT)).rejects.toThrow(MetaInterestRepositoryError);

    client.forceErrorOnce("meta_interests", "db down");
    await expect(repo.listByTenant("dss-motor")).rejects.toThrow(MetaInterestRepositoryError);
  });
});
