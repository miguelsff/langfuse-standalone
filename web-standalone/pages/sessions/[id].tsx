import Link from "next/link";
import { useRouter } from "next/router";
import { AnnotationsPanel } from "@/components/annotations-panel";
import { JsonValue } from "@/components/json-value";
import { PageHeader } from "@/components/page-header";
import { api } from "@/utils/api";
import { formatDate } from "@/utils/format";

export default function SessionDetailPage() {
  const router = useRouter();
  const id = typeof router.query.id === "string" ? router.query.id : "";
  const detail = api.sessions.detail.useQuery(
    { id },
    { enabled: Boolean(id) },
  );
  if (detail.isLoading) return <p>Loading session…</p>;
  if (detail.error) return <div className="error-box">{detail.error.message}</div>;
  if (!detail.data) return null;
  const { session } = detail.data;
  return (
    <>
      <PageHeader
        description={`${session.traces.length} traces · ${formatDate(session.createdAt)}`}
        title={session.id}
      />
      <section className="detail-grid">
        <article className="card">
          <small>User</small>
          <p>{session.userId ?? "—"}</p>
        </article>
        <article className="card">
          <h2>Metadata</h2>
          <JsonValue value={session.metadata} />
        </article>
      </section>
      <section style={{ marginTop: "1.5rem" }}>
        <h2>Traces</h2>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Timestamp</th>
                <th>Level</th>
              </tr>
            </thead>
            <tbody>
              {session.traces.map((trace) => (
                <tr key={trace.id}>
                  <td>
                    <Link
                      className="link"
                      href={`/project/local/traces/${trace.id}`}
                    >
                      {trace.name || trace.id}
                    </Link>
                  </td>
                  <td>{formatDate(trace.timestamp)}</td>
                  <td>{trace.level}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      <AnnotationsPanel targetId={session.id} targetType="SESSION" />
    </>
  );
}
