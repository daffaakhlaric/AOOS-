import { afterEach, describe, expect, it, vi } from "vitest";

import { fetchListingById } from "@/lib/aaos-api-client";

describe("fetchListingById", () => {
  const originalBaseUrl = process.env["AAOS_API_BASE_URL"];
  const originalApiKey = process.env["AAOS_API_KEY"];

  afterEach(() => {
    vi.unstubAllGlobals();
    if (originalBaseUrl === undefined) {
      delete process.env["AAOS_API_BASE_URL"];
    } else {
      process.env["AAOS_API_BASE_URL"] = originalBaseUrl;
    }
    if (originalApiKey === undefined) {
      delete process.env["AAOS_API_KEY"];
    } else {
      process.env["AAOS_API_KEY"] = originalApiKey;
    }
  });

  it("returns undefined when AAOS_API_BASE_URL is not configured", async () => {
    delete process.env["AAOS_API_BASE_URL"];
    process.env["AAOS_API_KEY"] = "test-key";
    const result = await fetchListingById("listing-1");
    expect(result).toBeUndefined();
  });

  it("returns undefined when AAOS_API_KEY is not configured", async () => {
    process.env["AAOS_API_BASE_URL"] = "http://localhost:3000";
    delete process.env["AAOS_API_KEY"];
    const result = await fetchListingById("listing-1");
    expect(result).toBeUndefined();
  });

  it("fetches and maps a real listing response, sending the x-api-key header", async () => {
    process.env["AAOS_API_BASE_URL"] = "http://localhost:3000";
    process.env["AAOS_API_KEY"] = "test-key";

    const fetchMock = vi.fn(
      async (_url: URL, _init?: RequestInit) =>
        new Response(
          JSON.stringify({
            id: "listing-1",
            title: "Rumah Minimalis Cinere",
            propertyType: "RUMAH",
            price: 1_500_000_000,
            city: "Cinere",
            bedrooms: 3,
            bathrooms: 2,
          }),
          { status: 200 },
        ),
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await fetchListingById("listing-1");
    expect(result).toEqual({
      id: "listing-1",
      title: "Rumah Minimalis Cinere",
      propertyType: "RUMAH",
      price: 1_500_000_000,
      city: "Cinere",
      bedrooms: 3,
      bathrooms: 2,
    });

    const [url, init] = fetchMock.mock.calls[0] as [URL, RequestInit];
    expect(url.pathname).toBe("/api/v1/listings/listing-1");
    expect((init.headers as Record<string, string>)["x-api-key"]).toBe("test-key");
  });

  it("returns undefined on a non-2xx response", async () => {
    process.env["AAOS_API_BASE_URL"] = "http://localhost:3000";
    process.env["AAOS_API_KEY"] = "test-key";
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify({ message: "not found" }), { status: 404 })),
    );

    const result = await fetchListingById("missing");
    expect(result).toBeUndefined();
  });

  it("returns undefined on a network failure", async () => {
    process.env["AAOS_API_BASE_URL"] = "http://localhost:3000";
    process.env["AAOS_API_KEY"] = "test-key";
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("network down");
      }),
    );

    const result = await fetchListingById("listing-1");
    expect(result).toBeUndefined();
  });

  it("returns undefined when the response body is not valid JSON", async () => {
    process.env["AAOS_API_BASE_URL"] = "http://localhost:3000";
    process.env["AAOS_API_KEY"] = "test-key";
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("not json", { status: 200 })),
    );

    const result = await fetchListingById("listing-1");
    expect(result).toBeUndefined();
  });

  it("returns undefined when the response shape is missing required fields", async () => {
    process.env["AAOS_API_BASE_URL"] = "http://localhost:3000";
    process.env["AAOS_API_KEY"] = "test-key";
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify({ id: "listing-1" }), { status: 200 })),
    );

    const result = await fetchListingById("listing-1");
    expect(result).toBeUndefined();
  });

  it("returns undefined when propertyType is not one of the 5 valid types", async () => {
    process.env["AAOS_API_BASE_URL"] = "http://localhost:3000";
    process.env["AAOS_API_KEY"] = "test-key";
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(
            JSON.stringify({ id: "listing-1", title: "X", propertyType: "MOBIL", price: 1 }),
            { status: 200 },
          ),
      ),
    );

    const result = await fetchListingById("listing-1");
    expect(result).toBeUndefined();
  });
});
