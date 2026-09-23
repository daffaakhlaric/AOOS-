/** @type {import('next').NextConfig} */
// Keep development artifacts separate from production builds. Running `next build` while the
// local dev server is open must not replace the dev manifest and turn every CSS/JS request into
// a 404 (the failure mode this V2 page previously exhibited).
const isDev = process.env.NODE_ENV === "development";
const nextConfig = {
  reactStrictMode: true,
  distDir: isDev ? ".next-dev" : ".next",
  // Same as apps/eyvra-dashboard: this app proxies all data over HTTP to apps/aaos-api rather
  // than importing any @aos/* workspace package's runtime values, so no transpilePackages needed.
};

export default nextConfig;
