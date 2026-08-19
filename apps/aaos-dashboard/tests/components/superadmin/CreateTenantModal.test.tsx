import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { CreateTenantModal } from "@/components/superadmin/CreateTenantModal";

describe("CreateTenantModal", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("auto-derives the tenant ID slug from the company name until the field is touched", async () => {
    render(<CreateTenantModal onClose={vi.fn()} onCreated={vi.fn()} />);
    await userEvent.type(screen.getByLabelText("Nama Perusahaan *"), "PropertyKlik Jakarta");
    expect(screen.getByLabelText("Tenant ID * (slug)")).toHaveValue("propertyklik-jakarta");
  });

  it("submits the form and calls onCreated on success", async () => {
    const fetchMock = vi.fn(
      async (_url: string, _init?: RequestInit) =>
        new Response(JSON.stringify({ tenantId: "propertyklik-jakarta" }), { status: 200 }),
    );
    global.fetch = fetchMock as unknown as typeof fetch;
    const onCreated = vi.fn();

    render(<CreateTenantModal onClose={vi.fn()} onCreated={onCreated} />);
    await userEvent.type(screen.getByLabelText("Nama Perusahaan *"), "PropertyKlik Jakarta");
    await userEvent.type(screen.getByLabelText("Email Admin *"), "admin@propertyklik.id");
    await userEvent.type(screen.getByLabelText(/Password Admin/), "password123");
    await userEvent.click(screen.getByRole("button", { name: "✓ Buat Tenant" }));

    await waitFor(() => expect(onCreated).toHaveBeenCalled());
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe("/api/superadmin/tenants");
    expect(init?.method).toBe("POST");
  });

  it("shows a validation error without calling fetch when the password is too short", async () => {
    const fetchMock = vi.fn();
    global.fetch = fetchMock as unknown as typeof fetch;

    render(<CreateTenantModal onClose={vi.fn()} onCreated={vi.fn()} />);
    await userEvent.type(screen.getByLabelText("Nama Perusahaan *"), "PropertyKlik Jakarta");
    await userEvent.type(screen.getByLabelText("Email Admin *"), "admin@propertyklik.id");
    await userEvent.type(screen.getByLabelText(/Password Admin/), "short");
    await userEvent.click(screen.getByRole("button", { name: "✓ Buat Tenant" }));

    expect(await screen.findByText(/Password admin minimal/)).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
