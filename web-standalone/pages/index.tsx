import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { api } from "@/utils/api";
import { formatCost, formatNumber } from "@/utils/format";

export default function OverviewPage() {
  const status = api.system.status.useQuery();
  const metrics = api.dashboards.metrics.useQuery();
  const utilities = api.useUtils();
  const reload = api.system.reloadJson.useMutation({
    onSuccess: async () => {
      await Promise.all([
        utilities.system.status.invalidate(),
        utilities.dashboards.metrics.invalidate(),
        utilities.traces.invalidate(),
        utilities.observations.invalidate(),
        utilities.sessions.invalidate(),
      ]);
    },
  });

  const cards = [
    ["Traces", formatNumber(metrics.data?.traceCount ?? 0)],
    ["Observations", formatNumber(metrics.data?.observationCount ?? 0)],
    ["Sessions", formatNumber(metrics.data?.sessionCount ?? 0)],
    ["Errors", formatNumber(metrics.data?.errorCount ?? 0)],
    ["Total cost", formatCost(metrics.data?.totalCost)],
    [
      "Average latency",
      `${formatNumber(metrics.data?.averageLatencyMs ?? 0)} ms`,
    ],
  ];

  return (
    <>
      <PageHeader
        actions={
          <button
            className="button"
            disabled={reload.isPending}
            onClick={() => reload.mutate()}
            type="button"
          >
            Reload JSON
          </button>
        }
        description="Trace analysis and manual evaluation in one local process."
        title="Standalone overview"
      />
      <section className="metrics-grid">
        {cards.map(([label, value]) => (
          <article className="card metric" key={label}>
            <small>{label}</small>
            <strong>{value}</strong>
          </article>
        ))}
      </section>
      <section className="card stack" style={{ marginTop: "1rem" }}>
        <div className="section-heading">
          <div>
            <h2>Runtime status</h2>
            <p className="muted">
              JSON is read-only telemetry. SQLite contains local changes.
            </p>
          </div>
          <span className="badge">127.0.0.1 only</span>
        </div>
        <div className="detail-grid">
          <div>
            <small>Mode</small>
            <p>{status.data?.mode ?? "Loading…"}</p>
          </div>
          <div>
            <small>Database</small>
            <p>{status.data?.database ?? "Loading…"}</p>
          </div>
          <div>
            <small>Authentication</small>
            <p>{status.data?.authentication === false ? "Disabled" : "—"}</p>
          </div>
          <div>
            <small>JSON validation errors</small>
            <p>{status.data?.json.errors.length ?? 0}</p>
          </div>
        </div>
        {status.data?.json.errors.map((error) => (
          <div className="error-box" key={error}>
            {error}
          </div>
        ))}
        <p>
          Add files using the documented schema under{" "}
          <code>data/json</code>, then reload. Start with the{" "}
          <Link className="link" href="/project/local/traces">
            example trace
          </Link>
          .
        </p>
      </section>
    </>
  );
}
