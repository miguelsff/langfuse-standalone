import Link from "next/link";
import { useState } from "react";
import { PageHeader } from "@/components/page-header";
import { api } from "@/utils/api";
import { formatDate } from "@/utils/format";

export default function ObservationsPage() {
  const [page, setPage] = useState(1);
  const observations = api.observations.list.useQuery({ page, limit: 50 });
  return (
    <>
      <PageHeader
        description="All observation types from the local JSON index."
        tabs={[
          {
            href: "/project/local/traces",
            label: "Traces",
          },
          {
            href: "/project/local/observations",
            label: "Observations",
            active: true,
          },
        ]}
        title="Tracing"
      />
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Type</th>
              <th>Trace</th>
              <th>Started</th>
              <th>Model</th>
              <th>Level</th>
            </tr>
          </thead>
          <tbody>
            {observations.data?.items.map((item) => (
              <tr key={item.id}>
                <td>
                  <Link
                    className="link"
                    href={`/project/local/observations/${item.id}`}
                  >
                    {item.name || item.id}
                  </Link>
                  <br />
                  <small>{item.id}</small>
                </td>
                <td>{item.type}</td>
                <td>
                  <Link
                    className="link"
                    href={`/project/local/traces/${item.traceId}`}
                  >
                    {item.traceId}
                  </Link>
                </td>
                <td>{formatDate(item.startTime)}</td>
                <td>{item.model ?? "—"}</td>
                <td>{item.level}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
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
          Page {page} · {observations.data?.total ?? 0} observations
        </span>
        <button
          className="button secondary"
          disabled={page * 50 >= (observations.data?.total ?? 0)}
          onClick={() => setPage((value) => value + 1)}
          type="button"
        >
          Next
        </button>
      </div>
    </>
  );
}
