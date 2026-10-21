import { afterEach, it, expect, vi } from "vitest";
import { cleanup, render, screen, fireEvent, waitFor } from "@testing-library/react";
import { KaiStudio } from "@/components/kai/KaiStudio";
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));
const pkg = {
  id: "p",
  briefId: "b",
  title: "Creative test",
  status: "APPROVED",
  origin: "SAMANTHA",
  imageUrls: ["/generated.png"],
  videoUrl: "/generated.mp4",
  sourcePhotoUrls: ["/source.png"],
  copyVariants: [],
  angle: "LOCATION",
  requestedFormat: "VIDEO_AND_IMAGES",
  createdAt: "2026-09-22",
  reason: "Refresh",
  primaryMessage: "Family",
};
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
it("selects real video variants and preserves QA state when an image fails", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => ({
      ok: true,
      json: async () =>
        url.includes("/api/creative/")
          ? {
              package: pkg,
              logs: [
                {
                  id: "q",
                  createdAt: "2026-09-22",
                  eventType: "QA",
                  metadata: { qaPassed: true, qaChecks: [] },
                },
              ],
            }
          : { packages: [pkg] },
    })),
  );
  render(<KaiStudio briefId="b" />);
  fireEvent.click(await screen.findByRole("button", { name: "Buka Inspector →" }));
  await screen.findByRole("button", { name: "Select Video" });
  await waitFor(() =>
    expect(
      screen.getByText("Technical media checks passed.", { exact: false }),
    ).toBeInTheDocument(),
  );
  const generated = screen
    .getAllByRole("img", { name: "Creative test" })
    .find((e) => e.getAttribute("src") === "/generated.png");
  fireEvent.error(generated!);
  expect(screen.getByText("Technical media checks passed.", { exact: false })).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Select Video" }));
  expect(document.querySelector("video")?.getAttribute("src")).toBe("/generated.mp4");
  expect(document.querySelector("video")?.hasAttribute("controls")).toBe(true);
});
it("shows fetch failure with retry instead of an empty successful queue", async () => {
  vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
  render(<KaiStudio />);
  expect(await screen.findByRole("alert")).toHaveTextContent("Production data could not be loaded");
  expect(screen.getByRole("button", { name: "Retry production data" })).toBeInTheDocument();
});
it("keeps manual edits across mode switches and never generates fake assets", async () => {
  const fetcher = vi.fn(async (url: string, _options?: RequestInit) => ({
    ok: true,
    json: async () =>
      url.includes("/api/creative/")
        ? { package: { ...pkg, status: "DRAFT", imageUrls: [], videoUrl: undefined }, logs: [] }
        : { packages: [{ ...pkg, status: "DRAFT", imageUrls: [], videoUrl: undefined }] },
  }));
  vi.stubGlobal("fetch", fetcher);
  render(<KaiStudio briefId="b" />);
  fireEvent.click(await screen.findByRole("button", { name: "Manual" }));
  fireEvent.change(screen.getByLabelText("Target Audience"), {
    target: { value: "Investor draft" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Auto dari Samantha" }));
  fireEvent.click(screen.getByRole("button", { name: "Manual" }));
  expect(screen.getByLabelText("Target Audience")).toHaveValue("Investor draft");
  expect(screen.getByRole("button", { name: "✧ Generate Konsep Creative" })).toBeDisabled();
  expect(screen.getByRole("button", { name: "✧ Generate Image" })).toBeDisabled();
  expect(screen.getByText("Belum ada hasil pada format ini")).toBeInTheDocument();
  expect(fetcher.mock.calls.every(([, options]) => !options || !("method" in options))).toBe(true);
});
it("allows local scene planning and blocks shortlist without recorded QA", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => ({
      ok: true,
      json: async () =>
        url.includes("/api/creative/") ? { package: pkg, logs: [] } : { packages: [pkg] },
    })),
  );
  render(<KaiStudio briefId="b" />);
  fireEvent.click(await screen.findByRole("button", { name: "＋ Tambah Scene" }));
  fireEvent.change(screen.getByLabelText("Overlay"), { target: { value: "Lihat properti" } });
  expect(screen.getByLabelText("Overlay")).toHaveValue("Lihat properti");
  expect(
    screen
      .getAllByLabelText("Pilih untuk shortlist")
      .every((e) => (e as HTMLInputElement).disabled),
  ).toBe(true);
  fireEvent.click(screen.getByRole("button", { name: "Hapus scene 1" }));
  expect(screen.getByText("Belum ada storyboard")).toBeInTheDocument();
});
