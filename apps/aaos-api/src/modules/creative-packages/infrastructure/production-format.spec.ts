import { expect, it } from "vitest";

import { createFakeSupabaseClient } from "../../../test-support/fake-supabase-client.js";

import { CreativePackageRepository } from "./creative-package.repository.js";
it("reads canonical format only for requested concepts in the caller tenant", async () => {
  const db = createFakeSupabaseClient();
  db.seed("kai_concepts", { id: "a", tenant_id: "one", data: { format: "CAROUSEL" } });
  db.seed("kai_concepts", { id: "b", tenant_id: "two", data: { format: "VIDEO" } });
  db.seed("kai_concepts", { id: "c", tenant_id: "one", data: { format: "IMAGE" } });
  const formats = await new CreativePackageRepository(db).productionFormats("one", ["a", "b"]);
  expect([...formats]).toEqual([["a", "CAROUSEL"]]);
});
