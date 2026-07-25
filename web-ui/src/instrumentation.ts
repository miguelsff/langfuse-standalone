// The standalone replica has no database, queue, or telemetry process to
// initialize. Keeping the hook as a no-op prevents backend-only packages from
// loading during dev/build.
export async function register() {}
