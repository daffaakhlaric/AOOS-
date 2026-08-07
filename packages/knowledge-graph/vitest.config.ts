import { withBaseConfig } from "../../configs/vitest-config/base";

export default withBaseConfig({
  test: {
    coverage: {
      exclude: [
        "src/**/*.d.ts",
        "src/**/index.ts",
        "src/**/i-*.ts",
        // Pure type/interface files (no runtime code — every export is `interface`/`type`, so
        // there is nothing for V8 to execute; they are still real, load-bearing contracts,
        // exercised indirectly through the factories/managers that construct these shapes).
        "src/domain/graph-cluster.ts",
        "src/domain/graph-configuration.ts",
        "src/domain/graph-metrics.ts",
        "src/domain/graph-path.ts",
        "src/domain/graph-relationship.ts",
        "src/domain/graph-snapshot.ts",
        "src/domain/graph-statistics.ts",
        "src/domain/graph-traversal.ts",
        "src/domain/graph-version.ts",
        "src/domain/knowledge-edge.ts",
        "src/domain/knowledge-graph.ts",
        "src/domain/knowledge-node.ts",
        "src/queries/graph-query.ts",
        "src/pipeline/graph-operation-descriptor.ts",
        "src/middleware/pipeline-middleware.ts",
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
