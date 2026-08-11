import { describe, expect, it, vi } from "vitest";

const redirectSpy = vi.fn((url: string) => {
  throw new Error(`NEXT_REDIRECT:${url}`);
});

vi.mock("next/navigation", () => ({
  redirect: redirectSpy,
}));

describe("HomePage", () => {
  it("redirects to /simulator", async () => {
    const { default: HomePage } = await import("@/app/page");
    expect(() => HomePage()).toThrow("NEXT_REDIRECT:/simulator");
    expect(redirectSpy).toHaveBeenCalledWith("/simulator");
  });
});
