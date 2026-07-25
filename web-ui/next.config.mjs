// Some client-facing Langfuse modules re-export shared runtime helpers. The
// mock app never connects to these services, but the shared package validates
// their values during module evaluation, so provide inert local defaults.
process.env.CLICKHOUSE_URL ??= "http://localhost:8123";
process.env.CLICKHOUSE_USER ??= "default";
process.env.CLICKHOUSE_PASSWORD ??= "mock-password";
process.env.LANGFUSE_S3_EVENT_UPLOAD_BUCKET ??= "web-ui-mock";

/** @type {import("next").NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: "standalone",
  poweredByHeader: false,
  distDir: process.env.NEXT_DIST_DIR || ".next",
  typescript: {
    ignoreBuildErrors: process.env.NEXT_IGNORE_BUILD_ERRORS === "true",
  },
  allowedDevOrigins: ["127.0.0.1"],
  transpilePackages: ["@langfuse/shared"],
  i18n: { locales: ["en"], defaultLocale: "en" },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        ],
      },
    ];
  },
};

export default nextConfig;
