import { render, screen, cleanup } from "@testing-library/react";
import { it, expect, afterEach } from "vitest";
import { KaiStudioHub } from "@/components/kai/KaiStudioHub";
import { KaiStudioNavigation } from "@/components/kai/KaiStudioNavigation";
import type { KaiPackage } from "@/lib/kai-studio";
afterEach(cleanup);
it("keeps all ten workspace links and identifies the active format", () => {
  render(<KaiStudioNavigation view="carousel" />);
  expect(screen.getAllByRole("link")).toHaveLength(10);
  expect(screen.getByRole("link", { name: "Carousel Studio" })).toHaveAttribute(
    "aria-current",
    "page",
  );
});
it("uses persisted carousel metadata rather than treating multiple images as carousel", () => {
  const base = {
    briefId: "brief",
    status: "DRAFT" as const,
    requestedFormat: "IMAGES_ONLY",
    imageUrls: ["https://example.com/a.png", "https://example.com/b.png"],
    sourcePhotoUrls: [],
    reason: "Source story",
    vertical: "PROPERTY",
    angle: "LOCATION",
    primaryMessage: "Source story",
    origin: "SAMANTHA",
    copyVariants: [],
    createdAt: "2026-10-06T00:00:00Z",
  };
  const packages = [
    { ...base, id: "carousel", title: "Actual carousel", productionFormat: "CAROUSEL" },
    { ...base, id: "image", title: "Image bundle" },
  ] as KaiPackage[];
  render(
    <KaiStudioHub
      view="carousel"
      packages={packages}
      projects={[]}
      search=""
      queueError={false}
      refresh={() => {}}
    />,
  );
  expect(screen.getByText("Actual carousel")).toBeInTheDocument();
  expect(screen.queryByText("Image bundle")).not.toBeInTheDocument();
});
