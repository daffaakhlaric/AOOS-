import { describe, expect, it } from "vitest";

import { createFakeSupabaseClient } from "../../../test-support/fake-supabase-client.js";

import { ListingRepository, ListingRepositoryError } from "./listing.repository.js";

function seedRow(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: "listing-1",
    tenant_id: "propertyklik-demo",
    title: "Rumah Bintaro 88m²",
    property_type: "RUMAH",
    listing_status: "AKTIF",
    price: 1_800_000_000,
    branch_id: "BINTARO",
    wa_number: "+628123456789",
    land_area: 88,
    build_area: 70,
    bedrooms: 3,
    bathrooms: 2,
    garage: 1,
    floors: 2,
    certificate: "SHM",
    condition: null,
    electricity: null,
    facing: null,
    address: null,
    city: "Tangerang Selatan",
    province: "Banten",
    postal_code: null,
    description: null,
    highlights: [],
    photos: [],
    main_photo_url: null,
    in_knowledge_base: false,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("ListingRepository", () => {
  it("inserts a row and returns it", async () => {
    const client = createFakeSupabaseClient();
    const repo = new ListingRepository(client);
    const row = await repo.insert({
      tenant_id: "propertyklik-demo",
      title: "Apartemen Cinere",
      property_type: "APARTEMEN",
      listing_status: "DRAFT",
      price: 900_000_000,
      branch_id: null,
      wa_number: null,
      land_area: null,
      build_area: null,
      bedrooms: null,
      bathrooms: null,
      garage: null,
      floors: null,
      certificate: null,
      condition: null,
      electricity: null,
      facing: null,
      address: null,
      city: null,
      province: null,
      postal_code: null,
      description: null,
      highlights: [],
      photos: [],
      main_photo_url: null,
      documents: [],
      in_knowledge_base: false,
    });
    expect(row.title).toBe("Apartemen Cinere");
  });

  it("findById returns undefined for a missing row", async () => {
    const client = createFakeSupabaseClient();
    const repo = new ListingRepository(client);
    expect(await repo.findById("missing")).toBeUndefined();
  });

  it("listByTenant filters by tenant_id", async () => {
    const client = createFakeSupabaseClient();
    client.seed("listings", seedRow());
    client.seed("listings", seedRow({ id: "listing-2", tenant_id: "other-tenant" }));
    const repo = new ListingRepository(client);
    const rows = await repo.listByTenant("propertyklik-demo");
    expect(rows).toHaveLength(1);
    expect(rows[0]?.id).toBe("listing-1");
  });

  it("updateById patches the row in place", async () => {
    const client = createFakeSupabaseClient();
    client.seed("listings", seedRow());
    const repo = new ListingRepository(client);
    const updated = await repo.updateById("listing-1", { listing_status: "TERJUAL" });
    expect(updated.listing_status).toBe("TERJUAL");
  });

  it("deleteById removes the row", async () => {
    const client = createFakeSupabaseClient();
    client.seed("listings", seedRow());
    const repo = new ListingRepository(client);
    await repo.deleteById("listing-1");
    expect(await repo.findById("listing-1")).toBeUndefined();
  });

  it("throws ListingRepositoryError on a forced Supabase error (listByTenant)", async () => {
    const client = createFakeSupabaseClient();
    client.forceErrorOnce("listings", "boom");
    const repo = new ListingRepository(client);
    await expect(repo.listByTenant("propertyklik-demo")).rejects.toThrow(ListingRepositoryError);
  });

  it("throws ListingRepositoryError on a forced Supabase error (findById)", async () => {
    const client = createFakeSupabaseClient();
    client.forceErrorOnce("listings", "boom");
    const repo = new ListingRepository(client);
    await expect(repo.findById("listing-1")).rejects.toThrow(ListingRepositoryError);
  });

  it("throws ListingRepositoryError on a forced Supabase error (insert)", async () => {
    const client = createFakeSupabaseClient();
    client.forceErrorOnce("listings", "boom");
    const repo = new ListingRepository(client);
    await expect(
      repo.insert({
        tenant_id: "propertyklik-demo",
        title: "x",
        property_type: "RUMAH",
        listing_status: "DRAFT",
        price: 1,
        branch_id: null,
        wa_number: null,
        land_area: null,
        build_area: null,
        bedrooms: null,
        bathrooms: null,
        garage: null,
        floors: null,
        certificate: null,
        condition: null,
        electricity: null,
        facing: null,
        address: null,
        city: null,
        province: null,
        postal_code: null,
        description: null,
        highlights: [],
        photos: [],
        main_photo_url: null,
        in_knowledge_base: false,
      }),
    ).rejects.toThrow(ListingRepositoryError);
  });

  it("throws ListingRepositoryError on a forced Supabase error (updateById)", async () => {
    const client = createFakeSupabaseClient();
    client.seed("listings", seedRow());
    client.forceErrorOnce("listings", "boom");
    const repo = new ListingRepository(client);
    await expect(repo.updateById("listing-1", { title: "x" })).rejects.toThrow(
      ListingRepositoryError,
    );
  });

  it("throws ListingRepositoryError on a forced Supabase error (deleteById)", async () => {
    const client = createFakeSupabaseClient();
    client.seed("listings", seedRow());
    client.forceErrorOnce("listings", "boom");
    const repo = new ListingRepository(client);
    await expect(repo.deleteById("listing-1")).rejects.toThrow(ListingRepositoryError);
  });
});
