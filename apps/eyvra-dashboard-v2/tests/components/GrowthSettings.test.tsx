import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react";
import { afterEach, it, expect, vi } from "vitest";
import { GrowthSettings } from "@/components/automation/GrowthSettings";
const policy = {
  growthObjective: "QUALIFIED_LEADS",
  pace: "MODERATE",
  autonomousMode: "COPILOT",
  targetWindowDays: 30,
  targets: { monthlyLeads: null, costPerOutcome: null, roas: null, monthlySales: null },
  budgetPolicy: {
    autoScaleEnabled: false,
    autoReduceEnabled: false,
    maximumCostPerOutcome: null,
    minimumLeads: 20,
    minimumObservationHours: 72,
  },
  creativePolicy: { autoWinnerExpansion: false },
};
const view = {
  policy,
  defaults: policy,
  version: 3,
  updatedAt: null,
  canEdit: true,
  readiness: { ready: false, blockers: ["Tracking belum terverifikasi."] },
  estimate: { status: "UNAVAILABLE", reason: "Belum cukup data untuk membuat estimasi." },
  paceProfiles: { MODERATE: { scalePercent: 10, cooldownHours: 72, reviewHours: 48 } },
};
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
it("keeps edits local until save and submits the expected version", async () => {
  const fetcher = vi
    .fn()
    .mockResolvedValueOnce({ ok: true, json: async () => view })
    .mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        ...view,
        version: 4,
        policy: { ...policy, targets: { ...policy.targets, monthlyLeads: 300 } },
      }),
    });
  vi.stubGlobal("fetch", fetcher);
  render(<GrowthSettings />);
  fireEvent.change(await screen.findByLabelText("Target leads / bulan"), {
    target: { value: "300" },
  });
  expect(fetcher).toHaveBeenCalledTimes(1);
  expect(screen.getByText("Belum cukup data untuk membuat estimasi.")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: /Simpan Perubahan/ }));
  await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(2));
  const options = fetcher.mock.calls[1]![1];
  expect(JSON.parse(options.body)).toMatchObject({
    expectedVersion: 3,
    policy: { targets: { monthlyLeads: 300 } },
  });
});
it("shows a persistence error rather than pretending changes were saved", async () => {
  vi.stubGlobal(
    "fetch",
    vi
      .fn()
      .mockResolvedValueOnce({ ok: true, json: async () => view })
      .mockResolvedValueOnce({ ok: false, json: async () => ({ error: "STALE_POLICY" }) }),
  );
  render(<GrowthSettings />);
  fireEvent.change(await screen.findByLabelText("Target leads / bulan"), {
    target: { value: "200" },
  });
  fireEvent.click(screen.getByRole("button", { name: /Simpan Perubahan/ }));
  expect(await screen.findByRole("alert")).toHaveTextContent("STALE_POLICY");
  expect(screen.getByLabelText("Target leads / bulan")).toHaveValue(200);
});
