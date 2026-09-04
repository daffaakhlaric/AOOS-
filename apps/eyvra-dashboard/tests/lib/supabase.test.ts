import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const createBrowserClient = vi.fn((..._args: unknown[]) => ({ auth: {} }));

vi.mock("@supabase/ssr", () => ({
  createBrowserClient: (...args: unknown[]) => createBrowserClient(...args),
}));

import { createSupabaseBrowserClient } from "@/lib/supabase";

describe("createSupabaseBrowserClient", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env["NEXT_PUBLIC_SUPABASE_URL"] = "https://test-project.supabase.co";
    process.env["NEXT_PUBLIC_SUPABASE_ANON_KEY"] = "anon-key";
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    vi.clearAllMocks();
  });

  it("constructs a browser client with the configured URL and anon key", () => {
    createSupabaseBrowserClient();
    expect(createBrowserClient).toHaveBeenCalledWith(
      "https://test-project.supabase.co",
      "anon-key",
    );
  });

  it("throws when NEXT_PUBLIC_SUPABASE_URL is not set", () => {
    delete process.env["NEXT_PUBLIC_SUPABASE_URL"];
    expect(() => createSupabaseBrowserClient()).toThrow(/NEXT_PUBLIC_SUPABASE_URL/);
  });

  it("throws when NEXT_PUBLIC_SUPABASE_ANON_KEY is not set", () => {
    delete process.env["NEXT_PUBLIC_SUPABASE_ANON_KEY"];
    expect(() => createSupabaseBrowserClient()).toThrow(/NEXT_PUBLIC_SUPABASE_ANON_KEY/);
  });
});
