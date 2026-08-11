import { Branch } from "@aos/meta-ads-connector";
import { describe, expect, it } from "vitest";

import { DefaultAssetTagger } from "../../../src/application/services/DefaultAssetTagger.js";
import { AssetType } from "../../../src/domain/value-objects/AssetType.js";

describe("DefaultAssetTagger", () => {
  it("always derives a type: tag", () => {
    const tagger = new DefaultAssetTagger();
    const tags = tagger.deriveTags({ type: AssetType.UNIT_PHOTO });
    expect(tags.map((t) => t.toString())).toEqual(["type:UNIT_PHOTO"]);
  });

  it("derives a branch: tag when branch is present", () => {
    const tagger = new DefaultAssetTagger();
    const tags = tagger.deriveTags({ type: AssetType.UNIT_PHOTO, branch: Branch.BINTARO });
    expect(tags.map((t) => t.toString())).toContain("branch:BINTARO");
  });

  it("derives a model: tag when unitModel is present and non-empty", () => {
    const tagger = new DefaultAssetTagger();
    const tags = tagger.deriveTags({ type: AssetType.UNIT_PHOTO, unitModel: "Xpander Cross" });
    expect(tags.map((t) => t.toString())).toContain("model:Xpander Cross");
  });

  it("does not derive a model: tag when unitModel is an empty/whitespace string", () => {
    const tagger = new DefaultAssetTagger();
    const tags = tagger.deriveTags({ type: AssetType.UNIT_PHOTO, unitModel: "   " });
    expect(tags.map((t) => t.toString())).toEqual(["type:UNIT_PHOTO"]);
  });

  it("derives a year: tag when unitYear is present", () => {
    const tagger = new DefaultAssetTagger();
    const tags = tagger.deriveTags({ type: AssetType.UNIT_PHOTO, unitYear: 2019 });
    expect(tags.map((t) => t.toString())).toContain("year:2019");
  });

  it("derives all applicable tags together", () => {
    const tagger = new DefaultAssetTagger();
    const tags = tagger.deriveTags({
      type: AssetType.UNIT_PHOTO,
      branch: Branch.CINERE,
      unitModel: "Pajero Sport",
      unitYear: 2021,
    });
    expect(tags.map((t) => t.toString())).toEqual([
      "type:UNIT_PHOTO",
      "branch:CINERE",
      "model:Pajero Sport",
      "year:2021",
    ]);
  });
});
