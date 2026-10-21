import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react";
import { it, expect, vi, afterEach } from "vitest";
import { CopilotApprovals } from "@/components/samantha/CopilotApprovals";
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
it("shows actual reason and requires review before invoking approval", async () => {
  const fetcher = vi
    .fn()
    .mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        actions: [
          {
            id: "action-1",
            agent: "SAMANTHA",
            actionType: "REVIEW_CREATIVE_BRIEF",
            status: "PENDING",
            createdAt: "2026-10-06",
            payload: { reason: "Creative fatigue detected", creativePackageId: "package-1" },
          },
        ],
      }),
    })
    .mockResolvedValueOnce({ ok: true, json: async () => ({ status: "APPROVED" }) })
    .mockResolvedValue({ ok: true, json: async () => ({ actions: [] }) });
  vi.stubGlobal("fetch", fetcher);
  render(<CopilotApprovals />);
  fireEvent.click(await screen.findByText("Review alasan & aksi"));
  expect(screen.getByText("Creative fatigue detected")).toBeInTheDocument();
  expect(screen.getByText("Approve & Eksekusi")).toBeDisabled();
  fireEvent.click(screen.getByRole("checkbox"));
  fireEvent.click(screen.getByText("Approve & Eksekusi"));
  await waitFor(() =>
    expect(fetcher).toHaveBeenCalledWith(
      "/api/pending-actions/action-1/approve",
      expect.objectContaining({ method: "POST" }),
    ),
  );
});
