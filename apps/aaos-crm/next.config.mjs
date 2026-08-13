/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Coordinator note #1 (same as AAOS-W4A/aaos-dashboard): this app proxies all data
  // mutations/reads to apps/aaos-api over HTTP instead of composing @aos/lead-store or
  // @aos/branch-manager runtime values directly, so there is nothing here that needs
  // transpilePackages.
};

export default nextConfig;
