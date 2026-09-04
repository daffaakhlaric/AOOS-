/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // AAOS-W4A coordinator note #2: unlike `apps/aaos-simulator`, this app never imports any
  // `@aos/*` workspace package's runtime values (it proxies all data over HTTP to
  // `apps/aaos-api` instead) — so there is nothing here that needs `transpilePackages`.
};

export default nextConfig;
