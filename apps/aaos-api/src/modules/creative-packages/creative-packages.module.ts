import { Module } from "@nestjs/common";

import { CREATIVE_PACKAGE_STORE } from "../../di-tokens.js";
import { ApiKeyGuard } from "../meta-ads/guards/api-key.guard.js";

import { CREATIVE_PACKAGE_SEED } from "./creative-package.seed.js";
import { CreativePackageStore } from "./creative-package.store.js";
import { CreativePackagesController } from "./creative-packages.controller.js";
import { CreativePackagesService } from "./creative-packages.service.js";

/**
 * `CREATIVE_PACKAGE_STORE` is provided HERE (module-local), not in `AppModule.forRoot`'s global
 * providers — unlike `LEAD_STORE`/`META_ADS_CONNECTOR` (real external integrations composed once
 * at the app's composition root), this store is a self-contained MVP implementation detail of
 * this one module (AAOS-W4A coordinator note #3), so it doesn't need to be injectable from
 * anywhere else. `useFactory` seeds it once, at module construction, not per-request.
 */
@Module({
  controllers: [CreativePackagesController],
  providers: [
    CreativePackagesService,
    ApiKeyGuard,
    {
      provide: CREATIVE_PACKAGE_STORE,
      useFactory: (): CreativePackageStore => {
        const store = new CreativePackageStore();
        store.seed(CREATIVE_PACKAGE_SEED);
        return store;
      },
    },
  ],
})
export class CreativePackagesModule {}
