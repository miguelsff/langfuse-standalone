import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { api } from "@/utils/api";
import { formatDate } from "@/utils/format";

export default function SessionsPage() {
  const sessions = api.sessions.list.useQuery();
  return (
    <>
      <PageHeader
        description="Explicit sessions and sessions derived from traces."
        title="Sessions"
      />
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>ID</th>
              <th>Created</th>
              <th>User</th>
              <th>Traces</th>
            </tr>
          </thead>
          <tbody>
            {sessions.data?.map((session) => (
              <tr key={session.id}>
                <td>
                  <Link
                    className="link"
                    href={`/project/local/sessions/${session.id}`}
                  >
                    {session.id}
                  </Link>
                </td>
                <td>{formatDate(session.createdAt)}</td>
                <td>{session.userId ?? "—"}</td>
                <td>{session.traceCount}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
