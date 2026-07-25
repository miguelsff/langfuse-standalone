// Standalone UI environment. Backend-only Langfuse variables intentionally
// remain optional because this app resolves data through the mock endpoint.
/** @type {Record<string, any>} */
const values = {
  NODE_ENV: process.env.NODE_ENV ?? "development",
  BUILD_ID: "web-ui-mock",
  NEXT_PUBLIC_BUILD_ID: "web-ui-mock",
  NEXT_PUBLIC_BASE_PATH: "",
  NEXT_PUBLIC_LANGFUSE_CLOUD_REGION: undefined,
  NEXT_PUBLIC_POSTHOG_KEY: undefined,
  NEXT_PUBLIC_POSTHOG_HOST: undefined,
  LANGFUSE_ENABLE_EXPERIMENTAL_FEATURES: "true",
  LANGFUSE_MIGRATION_V4_WRITE_MODE: "legacy",
  LANGFUSE_CSP_ENFORCE_HTTPS: "false",
  TELEMETRY_ENABLED: "false",
};

export const env = new Proxy(values, {
  get(target, property) {
    if (typeof property === "symbol") return undefined;
    return target[property] ?? process.env[property];
  },
});
