import { describe, expect, it } from "vitest";

import { PendingAccessTokenStore } from "./pending-access-token-store.js";

describe("PendingAccessTokenStore", () => {
  it("returns undefined for a post id nothing was ever set for", () => {
    const store = new PendingAccessTokenStore();
    expect(store.get("does-not-exist")).toBeUndefined();
  });

  it("returns exactly what was set for a FACEBOOK target", () => {
    const store = new PendingAccessTokenStore();
    store.set("post-1", { platform: "FACEBOOK", pageId: "123", accessToken: "token-a" });
    expect(store.get("post-1")).toEqual({
      platform: "FACEBOOK",
      pageId: "123",
      accessToken: "token-a",
    });
  });

  it("returns exactly what was set for an INSTAGRAM target", () => {
    const store = new PendingAccessTokenStore();
    store.set("post-2", { platform: "INSTAGRAM", igUserId: "987", accessToken: "token-b" });
    expect(store.get("post-2")).toEqual({
      platform: "INSTAGRAM",
      igUserId: "987",
      accessToken: "token-b",
    });
  });

  it("overwrites a prior target for the same post id", () => {
    const store = new PendingAccessTokenStore();
    store.set("post-3", { platform: "FACEBOOK", pageId: "123", accessToken: "token-a" });
    store.set("post-3", { platform: "INSTAGRAM", igUserId: "987", accessToken: "token-b" });
    expect(store.get("post-3")).toEqual({
      platform: "INSTAGRAM",
      igUserId: "987",
      accessToken: "token-b",
    });
  });

  it("delete removes a stored target", () => {
    const store = new PendingAccessTokenStore();
    store.set("post-4", { platform: "FACEBOOK", pageId: "123", accessToken: "token-a" });
    store.delete("post-4");
    expect(store.get("post-4")).toBeUndefined();
  });

  it("delete on an id with nothing stored is a no-op", () => {
    const store = new PendingAccessTokenStore();
    expect(() => store.delete("nothing-here")).not.toThrow();
  });
});
