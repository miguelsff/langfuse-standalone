import Link from "next/link";
import { useState } from "react";
import { PageHeader } from "@/components/page-header";
import { api } from "@/utils/api";
import { formatCost, formatDate, formatNumber } from "@/utils/format";

export default function TracesPage() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [sessionId, setSessionId] = useState("");
  const traces = api.traces.list.useQuery({
    page,
    limit: 50,
    filters: {
      search: search || undefined,
      sessionId: sessionId || undefined,
    },
  });

  return (
    <>
      <PageHeader
        description="Telemetry loaded from local JSON files."
        tabs={[
          {
            href: "/project/local/traces",
            label: "Traces",
            active: true,
          },
          {
            href: "/project/local/observations",
            label: "Observations",
          },
        ]}
        title="Tracing"
      />
      <div className="filters">
        <label>
          <span className="muted">Search</span>
          <input
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(1);
            }}
            placeholder="ID, name or user"
            value={search}
          />
        </label>
        <label>
          <span className="muted">Session ID</span>
          <input
            onChange={(event) => {
              setSessionId(event.target.value);
              setPage(1);
            }}
            placeholder="Exact session ID"
            value={sessionId}
          />
        </label>
      </div>
      {traces.error ? (
        <div className="error-box">{traces.error.message}</div>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Timestamp</th>
                <th>User</th>
                <th>Session</th>
                <th>Latency</th>
                <th>Cost</th>
                <th>Level</th>
              </tr>
            </thead>
            <tbody>
              {traces.data?.items.map((trace) => (
                <tr key={trace.id}>
                  <td>
                    <Link
                      className="link"
                      href={`/project/local/traces/${trace.id}`}
                    >
                      {trace.name || trace.id}
                    </Link>
                    <br />
                    <small>{trace.id}</small>
                  </td>
                  <td>{formatDate(trace.timestamp)}</td>
                  <td>{trace.userId ?? "—"}</td>
                  <td>
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
                  </td>
                  <td>
                    {trace.durationMs == null
                      ? "—"
                      : `${formatNumber(trace.durationMs)} ms`}
                  </td>
                  <td>{formatCost(trace.totalCost)}</td>
                  <td>
                    <span
                      className={
                        trace.level === "ERROR" ? "badge error" : "badge"
                      }
                    >
                      {trace.level}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <div className="pagination">
        <button
          className="button secondary"
          disabled={page === 1}
          onClick={() => setPage((value) => value - 1)}
          type="button"
        >
          Previous
        </button>
        <span>
          Page {page} · {traces.data?.total ?? 0} traces
        </span>
        <button
          className="button secondary"
          disabled={page * 50 >= (traces.data?.total ?? 0)}
          onClick={() => setPage((value) => value + 1)}
          type="button"
        >
          Next
        </button>
      </div>
    </>
  );
}
