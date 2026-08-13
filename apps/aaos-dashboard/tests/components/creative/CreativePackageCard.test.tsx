import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { CreativePackageCard } from "@/components/creative/CreativePackageCard";
import type { CreativePackageDto } from "@/types/dashboard.types";

const PACKAGE: CreativePackageDto = {
  id: "KAI-001",
  briefId: "A003",
  branch: "BINTARO",
  unit: "Xpander",
  title: "Xpander Bintaro",
  videoUrl: "https://cdn.example.com/video.mp4",
  imageUrls: ["a.jpg", "b.jpg", "c.jpg"],
  copyVariants: [
    {
      id: "v-a",
      variantLabel: "A",
      primaryText: "Copy A text",
      headline: "H A",
      callToAction: "Hubungi",
    },
    {
      id: "v-b",
      variantLabel: "B",
      primaryText: "Copy B text",
      headline: "H B",
      callToAction: "Hubungi",
    },
  ],
  status: "PENDING",
  createdAt: "2026-08-09T00:00:00.000Z",
};

describe("CreativePackageCard", () => {
  it("renders video + 3 image slots", () => {
    render(<CreativePackageCard pkg={PACKAGE} onApprove={vi.fn()} onReject={vi.fn()} />);
    expect(screen.getByTestId("creative-video-slot")).toBeInTheDocument();
    expect(screen.getAllByTestId("creative-image-slot")).toHaveLength(3);
  });

  it("renders copy variant radio buttons", () => {
    render(<CreativePackageCard pkg={PACKAGE} onApprove={vi.fn()} onReject={vi.fn()} />);
    expect(screen.getAllByRole("radio")).toHaveLength(2);
  });

  it("Approve button calls onApprove with the selected variant id", async () => {
    const onApprove = vi.fn();
    render(<CreativePackageCard pkg={PACKAGE} onApprove={onApprove} onReject={vi.fn()} />);
    await userEvent.click(screen.getByRole("button", { name: /Approve/ }));
    expect(onApprove).toHaveBeenCalledWith("v-a");
  });

  it("Reject button calls onReject", async () => {
    const onReject = vi.fn();
    render(<CreativePackageCard pkg={PACKAGE} onApprove={vi.fn()} onReject={onReject} />);
    await userEvent.click(screen.getByRole("button", { name: /Reject/ }));
    expect(onReject).toHaveBeenCalledOnce();
  });

  it("hides approve/reject buttons once a package is no longer PENDING", () => {
    render(
      <CreativePackageCard
        pkg={{ ...PACKAGE, status: "APPROVED" }}
        onApprove={vi.fn()}
        onReject={vi.fn()}
      />,
    );
    expect(screen.queryByRole("button", { name: /Approve/ })).not.toBeInTheDocument();
  });

  it("selecting a different copy variant changes the approve payload", async () => {
    const onApprove = vi.fn();
    render(<CreativePackageCard pkg={PACKAGE} onApprove={onApprove} onReject={vi.fn()} />);
    await userEvent.click(screen.getByText(/Copy B:/));
    await userEvent.click(screen.getByRole("button", { name: /Approve/ }));
    expect(onApprove).toHaveBeenCalledWith("v-b");
  });
});
