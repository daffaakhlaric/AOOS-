import { z } from "zod";

import { MarketplacePackageStatus } from "./marketplace-package-status.js";

export const marketplacePackageStatusSchema = z.nativeEnum(MarketplacePackageStatus);
