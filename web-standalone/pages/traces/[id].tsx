import Link from "next/link";
import { useRouter } from "next/router";
import { AnnotationsPanel } from "@/components/annotations-panel";
import { JsonValue } from "@/components/json-value";
import { PageHeader } from "@/components/page-header";
import { api } from "@/utils/api";
import { formatCost, formatDate, formatNumber } from "@/utils/format";

export default function TraceDetailPage() {
  const router = useRouter();
  const id = typeof router.query.id === "string" ? router.query.id : "";
  const detail = api.traces.detail.useQuery(
    { id },
    { enabled: Boolean(id) },
  );

  if (detail.isLoading) return <p>Loading trace…</p>;
  if (detail.error) return <div className="error-box">{detail.error.message}</div>;
  if (!detail.data) return null;
  const { trace, observations } = detail.data;

  return (
    <>
      <PageHeader
        description={`${trace.id} · ${formatDate(trace.timestamp)}`}
        title={trace.name || "Trace"}
      />
      <section className="detail-grid">
        <article className="card">
          <small>User</small>
          <p>{trace.userId ?? "—"}</p>
          <small>Session</small>
          <p>
            {trace.sessionId ? (
              <Link
                className="link"
                href={`/project/local/sessions/${trace.sessionId}`}
              >
                {trace.sessionId}
              </Link>
            ) : (
              "—"
            )}
          </p>
        </article>
        <article className="card">
          <small>Latency</small>
          <p>
            {trace.durationMs == null
              ? "—"
              : `${formatNumber(trace.durationMs)} ms`}
          </p>
          <small>Cost</small>
          <p>{formatCost(trace.totalCost)}</p>
        </article>
        <article className="card">
          <h2>Input</h2>
          <JsonValue value={trace.input} />
        </article>
        <article className="card">
          <h2>Output</h2>
          <JsonValue value={trace.output} />
        </article>
        <article className="card wide">
          <h2>Metadata</h2>
          <JsonValue value={trace.metadata} />
        </article>
      </section>
      <section style={{ marginTop: "1.5rem" }}>
        <div className="section-heading">
          <h2>Observations ({observations.length})</h2>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Type</th>
                <th>Started</th>
                <th>Model</th>
                <th>Level</th>
              </tr>
            </thead>
            <tbody>
              {observations.map((observation) => (
                <tr key={observation.id}>
                  <td>
                    <Link
                      className="link"
                      href={`/project/local/observations/${observation.id}`}
                    >
                      {observation.name || observation.id}
                    </Link>
                  </td>
                  <td>{observation.type}</td>
                  <td>{formatDate(observation.startTime)}</td>
                  <td>{observation.model ?? "—"}</td>
                  <td>{observation.level}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      <AnnotationsPanel targetId={trace.id} targetType="TRACE" />
    </>
  );
}
