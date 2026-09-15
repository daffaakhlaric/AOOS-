import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { CreativePackageCard } from "@/components/creative/CreativePackageCard";
import type { CreativePackageDto } from "@/types/dashboard.types";

const PACKAGE: CreativePackageDto = {
  id: "11111111-1111-4111-8111-111111111111",
  briefId: "22222222-2222-4222-8222-222222222222",
  vertical: "AUTOMOTIVE",
  branch: "BINTARO",
  unit: "xpander-gls-2022-001",
  unitModel: "Xpander GLS 2022",
  title: "Xpander GLS 2022 BINTARO · DP_RINGAN",
  angle: "DP_RINGAN",
  targetPersona: "PRIMARY_FAMILY",
  reason: "Brief manual dibuat manager.",
  requestedFormat: "VIDEO_AND_IMAGES",
  decidedFormat: "VIDEO_AND_IMAGES",
  primaryMessage: "DP mulai 29 juta",
  urgency: "HIGH",
  origin: "MANUAL",
  status: "PENDING",
  aiRecommended: false,
  fatigueStatus: "NORMAL",
  sourcePhotoUrls: ["https://storage.googleapis.com/aoos/units/x/foto-1.jpg"],
  videoUrl: "https://storage.googleapis.com/aoos/ai-creatives/x/video.mp4",
  imageUrls: [
    "https://storage.googleapis.com/aoos/ai-creatives/x/a.jpg",
    "https://storage.googleapis.com/aoos/ai-creatives/x/b.jpg",
    "https://storage.googleapis.com/aoos/ai-creatives/x/c.jpg",
  ],
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
  aiModel: "veo3_fast+nano-banana-pro",
  confidenceScore: 0.83,
  createdAt: "2026-08-09T00:00:00.000Z",
  updatedAt: "2026-08-09T00:10:00.000Z",
};

describe("CreativePackageCard", () => {
  it("renders a REAL <video controls> and real <img> elements, not placeholder text", () => {
    render(<CreativePackageCard pkg={PACKAGE} onApprove={vi.fn()} onReject={vi.fn()} />);
    const video = screen.getByTestId("creative-video");
    expect(video.tagName).toBe("VIDEO");
    expect(video).toHaveAttribute("src", PACKAGE.videoUrl);
    expect(video).toHaveAttribute("controls");
    const images = screen.getAllByTestId("creative-image");
    expect(images).toHaveLength(3);
    expect(images[0]?.tagName).toBe("IMG");
    expect(screen.queryByText("▶ Video")).not.toBeInTheDocument();
  });

  it("shows the REAL Kie AI model string (no google/ prefix — confirmed live against api.kie.ai)", () => {
    render(<CreativePackageCard pkg={PACKAGE} onApprove={vi.fn()} onReject={vi.fn()} />);
    expect(screen.getByText(/veo3_fast\+nano-banana-pro/)).toBeInTheDocument();
  });

  it("reports honestly when Kai downgraded the requested format", () => {
    render(
      <CreativePackageCard
        pkg={{ ...PACKAGE, decidedFormat: "IMAGES_ONLY", videoUrl: undefined }}
        onApprove={vi.fn()}
        onReject={vi.fn()}
      />,
    );
    expect(screen.getByText(/Kai turunkan karena foto sumber tidak cukup/)).toBeInTheDocument();
    expect(screen.queryByTestId("creative-video")).not.toBeInTheDocument();
  });

  it("states plainly when no source photos existed at generate time", () => {
    render(
      <CreativePackageCard
        pkg={{ ...PACKAGE, sourcePhotoUrls: [] }}
        onApprove={vi.fn()}
        onReject={vi.fn()}
      />,
    );
    expect(screen.getByText(/tidak ada foto unit/i)).toBeInTheDocument();
  });

  it("surfaces a real pipeline error", () => {
    render(
      <CreativePackageCard
        pkg={{ ...PACKAGE, status: "FAILED", errorMessage: "Kie AI timeout after 15 minutes" }}
        onApprove={vi.fn()}
        onReject={vi.fn()}
      />,
    );
    expect(screen.getByTestId("creative-package-error")).toHaveTextContent("Kie AI timeout");
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

  // 042_creative_packages_ai_recommended.sql — real, persisted "AI Suggested" badge.
  it("does NOT show the AI Suggested badge for a package with no accepted recommendation", () => {
    render(<CreativePackageCard pkg={PACKAGE} onApprove={vi.fn()} onReject={vi.fn()} />);
    expect(screen.queryByTestId("ai-suggested-badge")).not.toBeInTheDocument();
  });

  it("shows the AI Suggested badge when pkg.aiRecommended is real, persisted true", () => {
    render(
      <CreativePackageCard
        pkg={{ ...PACKAGE, vertical: "PROPERTY", aiRecommended: true }}
        onApprove={vi.fn()}
        onReject={vi.fn()}
      />,
    );
    expect(screen.getByTestId("ai-suggested-badge")).toHaveTextContent("AI Suggested");
  });

  // Kai Creative Engine Sprint 5 (indicator) — real "Live di Meta" badge, distinct from AI Suggested.
  it("does NOT show the Live di Meta badge when publishedMetaAdIds is undefined (never attempted)", () => {
    render(<CreativePackageCard pkg={PACKAGE} onApprove={vi.fn()} onReject={vi.fn()} />);
    expect(screen.queryByTestId("published-meta-badge")).not.toBeInTheDocument();
  });

  it("does NOT show the Live di Meta badge when publishedMetaAdIds is [] (attempted, every createAd failed)", () => {
    render(
      <CreativePackageCard
        pkg={{ ...PACKAGE, publishedMetaAdIds: [] }}
        onApprove={vi.fn()}
        onReject={vi.fn()}
      />,
    );
    expect(screen.queryByTestId("published-meta-badge")).not.toBeInTheDocument();
  });

  it("shows the Live di Meta badge with the real ad count when publishedMetaAdIds has real ids", () => {
    render(
      <CreativePackageCard
        pkg={{ ...PACKAGE, publishedMetaAdIds: ["120000000000901", "120000000000902"] }}
        onApprove={vi.fn()}
        onReject={vi.fn()}
      />,
    );
    expect(screen.getByTestId("published-meta-badge")).toHaveTextContent("Live di Meta (2)");
  });
});
