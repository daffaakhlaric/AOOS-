/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // @aos/* workspace packages ship real TS source under NodeNext ESM (dist/*.js with .js
  // specifiers) — transpilePackages lets Next.js's own bundler process them directly rather than
  // requiring them to be pre-built in a way Next's default externalization would accept.
  transpilePackages: [
    "@aos/ai-judge",
    "@aos/branch-manager",
    "@aos/common",
    "@aos/conversation-simulator",
    "@aos/dss-inventory-connector",
    "@aos/errors",
    "@aos/sales-agent",
  ],
};

export default nextConfig;
