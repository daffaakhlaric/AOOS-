import { withBaseConfig } from "../../configs/vitest-config/base";

export default withBaseConfig({
  test: {
    include: ["tests/**/*.spec.ts"],
    coverage: {
      include: ["src/**/*.ts"],
      exclude: [
        "src/**/*.d.ts",
        "src/**/index.ts",
        "src/index.ts",
        "src/contracts/**/*.ts",
        "src/infrastructure/supabase/SupabaseTypes.ts",
        "src/infrastructure/supabase/SupabaseStorageTypes.ts",
        "src/domain/events/AssetUploaded.ts",
        "src/domain/events/AssetArchived.ts",
        "src/domain/events/AssetTagged.ts",
        "src/domain/events/CollectionUpdated.ts",
      ],
      thresholds: {
        statements: 100,
        branches: 95,
        functions: 100,
        lines: 100,
      },
    },
  },
});
