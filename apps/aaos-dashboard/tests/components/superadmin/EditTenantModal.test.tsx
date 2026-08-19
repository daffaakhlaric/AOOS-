import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { EditTenantModal } from "@/components/superadmin/EditTenantModal";

const TENANT = {
  id: "t-1",
  tenantId: "dss-motor",
  name: "DSS Motor",
  vertical: "AUTOMOTIVE" as const,
  status: "ACTIVE" as const,
  hasMetaToken: true,
  wabaCount: 4,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

describe("EditTenantModal", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("PUTs the updated fields and calls onSaved", async () => {
    const fetchMock = vi.fn(
      async (_url: string, _init?: RequestInit) =>
        new Response(JSON.stringify({ ...TENANT, status: "SUSPENDED" }), { status: 200 }),
    );
    global.fetch = fetchMock as unknown as typeof fetch;
    const onSaved = vi.fn();
    render(<EditTenantModal tenant={TENANT} onClose={vi.fn()} onSaved={onSaved} />);
    await userEvent.click(screen.getByRole("button", { name: "Suspended" }));
    await userEvent.click(screen.getByRole("button", { name: "✓ Simpan" }));
    await waitFor(() => expect(onSaved).toHaveBeenCalled());
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe("/api/superadmin/tenants/dss-motor");
    const sentBody = JSON.parse(String(init?.body)) as { status: string };
    expect(sentBody.status).toBe("SUSPENDED");
  });
});
