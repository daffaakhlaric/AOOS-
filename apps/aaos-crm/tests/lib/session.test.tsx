import { renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const getUser = vi.fn();
vi.mock("@/lib/supabase", () => ({
  createSupabaseBrowserClient: () => ({ auth: { getUser } }),
}));

import { useSalesSession } from "@/lib/session";

describe("useSalesSession", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("starts loading, then resolves the session with salesHumanId from user_metadata", async () => {
    getUser.mockResolvedValue({
      data: {
        user: {
          id: "user-1",
          email: "rina@dssmotor.id",
          user_metadata: { salesHumanId: "sales-rina", branchId: "CINERE" },
        },
      },
    });
    const { result } = renderHook(() => useSalesSession());
    expect(result.current.loading).toBe(true);
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.session).toEqual({
      userId: "user-1",
      email: "rina@dssmotor.id",
      salesHumanId: "sales-rina",
      branchId: "CINERE",
    });
  });

  it("falls back salesHumanId to userId when metadata is missing", async () => {
    getUser.mockResolvedValue({
      data: { user: { id: "user-2", email: undefined, user_metadata: {} } },
    });
    const { result } = renderHook(() => useSalesSession());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.session?.salesHumanId).toBe("user-2");
  });

  it("resolves session as undefined when there is no user", async () => {
    getUser.mockResolvedValue({ data: { user: null } });
    const { result } = renderHook(() => useSalesSession());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.session).toBeUndefined();
  });
});
