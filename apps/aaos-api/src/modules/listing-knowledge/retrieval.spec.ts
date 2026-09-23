import type { SupabaseClient } from "@supabase/supabase-js";
import { it, expect, vi } from "vitest";

import type { KnowledgeModelGateway } from "./knowledge-model.gateway.js";
import { ListingKnowledgeService } from "./listing-knowledge.service.js";
function setup(found = true) {
  const eq = vi.fn().mockReturnThis();
  const single = vi.fn().mockResolvedValue({
    data: found ? { id: "listing-a", title: "BSD", price: 3700000000 } : null,
    error: null,
  });
  const db = {
    from: vi.fn(() => ({ select: vi.fn().mockReturnValue({ eq, maybeSingle: single }) })),
    rpc: vi.fn().mockResolvedValue({ data: [], error: null }),
  };
  eq.mockImplementation(() => ({ eq, maybeSingle: single }));
  const model = { embed: vi.fn().mockResolvedValue([Array(1536).fill(0.1)]) };
  const service = new ListingKnowledgeService(
    db as unknown as SupabaseClient,
    undefined,
    model as KnowledgeModelGateway,
  );
  return { service, db, eq, model };
}
it("scopes authorization and hybrid RPC to both tenant and listing", async () => {
  const { service, db, eq } = setup();
  const result = await service.retrieve("tenant-a", "listing-a", "DP 10%");
  expect(eq).toHaveBeenCalledWith("tenant_id", "tenant-a");
  expect(eq).toHaveBeenCalledWith("id", "listing-a");
  expect(db.rpc).toHaveBeenCalledWith(
    "search_listing_knowledge",
    expect.objectContaining({ p_tenant: "tenant-a", p_listing: "listing-a", p_query: "DP 10%" }),
  );
  expect(result.mode).toBe("HYBRID");
});
it("never searches or embeds when listing authorization fails", async () => {
  const { service, db, model } = setup(false);
  await expect(service.retrieve("tenant-b", "listing-a", "harga")).rejects.toThrow();
  expect(db.rpc).not.toHaveBeenCalled();
  expect(model.embed).not.toHaveBeenCalled();
});
it("labels provider failure as keyword-only and retains scopes", async () => {
  const { service, db, model } = setup();
  model.embed.mockRejectedValue(new Error("offline"));
  expect((await service.retrieve("tenant-a", "listing-a", "A-120")).mode).toBe("KEYWORD_ONLY");
  expect(db.rpc).toHaveBeenCalledWith(
    "search_listing_knowledge",
    expect.objectContaining({ p_embedding: null, p_tenant: "tenant-a", p_listing: "listing-a" }),
  );
});
it("rejects missing scope before querying the database", async () => {
  const { service, db } = setup();
  await expect(service.retrieve("", "listing-a", "price")).rejects.toThrow();
  expect(db.from).not.toHaveBeenCalled();
});
