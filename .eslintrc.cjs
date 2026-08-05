/** Root ESLint config — individual packages extend @aos/eslint-config with their own tsconfig. */
module.exports = {
  root: true,
  env: { node: true, es2022: true },
  extends: ["eslint:recommended"],
  ignorePatterns: [
    "**/dist/**",
    "**/coverage/**",
    "**/node_modules/**",
    "**/.turbo/**",
    "docker/data/**",
  ],
};
