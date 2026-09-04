import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { GET } from "@/app/api/closings/route";

describe("GET /api/closings", () => {
  beforeEach(() => {
    process.env["AAOS_API_BASE_URL"] = "http://localhost:3000";
    process.env["AAOS_API_KEY"] = "test-key";
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns { closings } on success, calling aaos-api with no date/branch params (aaos-api defaults to the current calendar month across every branch)", async () => {
    const fetchMock = vi.fn(
      async (_url: URL, _init?: RequestInit) =>
        new Response(
          JSON.stringify([{ id: "closing-1", closingType: "SPK", branchId: "BINTARO" }]),
          { status: 200 },
        ),
    );
    global.fetch = fetchMock as unknown as typeof fetch;

    const response = await GET();
    expect(response.status).toBe(200);
    const body = (await response.json()) as { closings: readonly { id: string }[] };
    expect(body.closings).toHaveLength(1);
    expect(body.closings[0]?.id).toBe("closing-1");

    const [calledUrl] = fetchMock.mock.calls[0]!;
    expect(String(calledUrl)).toBe("http://localhost:3000/api/v1/closings");
  });

  it("passes through an upstream error status/message", async () => {
    global.fetch = vi.fn(
      async () => new Response(JSON.stringify({ message: "server error" }), { status: 500 }),
    ) as unknown as typeof fetch;

    const response = await GET();
    expect(response.status).toBe(500);
    const body = (await response.json()) as { error: { message: string } };
    expect(body.error.message).toBe("server error");
  });
});
