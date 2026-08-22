import "reflect-metadata";

import { ok } from "@aos/common";
import { MetaOrganicConnectorFactory } from "@aos/meta-organic-connector";
import type * as MetaOrganicConnectorModule from "@aos/meta-organic-connector";
import { describe, expect, it, vi } from "vitest";

import { SosmedPublishingService } from "./sosmed-publishing.service.js";

vi.mock("@aos/meta-organic-connector", async () => {
  const actual = await vi.importActual<typeof MetaOrganicConnectorModule>(
    "@aos/meta-organic-connector",
  );
  return {
    ...actual,
    MetaOrganicConnectorFactory: {
      create: vi.fn(),
    },
  };
});

describe("SosmedPublishingService", () => {
  it("constructs its connector via MetaOrganicConnectorFactory.create() with no config", () => {
    const fakeConnector = {
      publishFacebookPost: { execute: vi.fn() },
      publishInstagramMedia: { execute: vi.fn() },
    };
    vi.mocked(MetaOrganicConnectorFactory.create).mockReturnValue(fakeConnector as never);

    new SosmedPublishingService();

    expect(MetaOrganicConnectorFactory.create).toHaveBeenCalledWith();
  });

  it("publishFacebookPost() delegates to connector.publishFacebookPost.execute with the request", async () => {
    const execute = vi.fn().mockResolvedValue(ok({ postId: "page-1_post-1" }));
    const fakeConnector = {
      publishFacebookPost: { execute },
      publishInstagramMedia: { execute: vi.fn() },
    };
    vi.mocked(MetaOrganicConnectorFactory.create).mockReturnValue(fakeConnector as never);

    const service = new SosmedPublishingService();
    const request = {
      pageId: "page-1",
      message: "Xpander Cross DP 29jt",
      accessToken: "TOKEN",
    };
    const result = await service.publishFacebookPost(request);

    expect(execute).toHaveBeenCalledWith(request);
    expect(result).toEqual(ok({ postId: "page-1_post-1" }));
  });

  it("publishInstagramPost() delegates to connector.publishInstagramMedia.execute with the request", async () => {
    const execute = vi.fn().mockResolvedValue(ok({ mediaId: "media-1" }));
    const fakeConnector = {
      publishFacebookPost: { execute: vi.fn() },
      publishInstagramMedia: { execute },
    };
    vi.mocked(MetaOrganicConnectorFactory.create).mockReturnValue(fakeConnector as never);

    const service = new SosmedPublishingService();
    const request = {
      igUserId: "ig-1",
      media: { kind: "IMAGE" as const, imageUrl: "https://gcs.example/unit.jpg" },
      accessToken: "TOKEN",
    };
    const result = await service.publishInstagramPost(request);

    expect(execute).toHaveBeenCalledWith(request);
    expect(result).toEqual(ok({ mediaId: "media-1" }));
  });
});
