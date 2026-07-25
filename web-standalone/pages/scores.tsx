import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { api } from "@/utils/api";
import { formatDate } from "@/utils/format";

export default function ScoresPage() {
  const scores = api.annotations.listScores.useQuery();
  const target = (score: NonNullable<typeof scores.data>[number]) => {
    if (score.traceId)
      return {
        href: `/project/local/traces/${score.traceId}`,
        id: score.traceId,
      };
    if (score.observationId)
      return {
        href: `/project/local/observations/${score.observationId}`,
        id: score.observationId,
      };
    if (score.sessionId)
      return {
        href: `/project/local/sessions/${score.sessionId}`,
        id: score.sessionId,
      };
    return null;
  };

  return (
    <>
      <PageHeader
        description="Manual annotations and LLM evaluation results stored in SQLite."
        title="Scores"
      />
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Value</th>
              <th>Target</th>
              <th>Source</th>
              <th>Created</th>
              <th>Reason</th>
            </tr>
          </thead>
          <tbody>
            {scores.data?.map((score) => {
              const scoreTarget = target(score);
              return (
                <tr key={score.id}>
                  <td>{score.name}</td>
                  <td>{score.value ?? score.stringValue ?? "—"}</td>
                  <td>
                    {scoreTarget ? (
                      <Link className="link" href={scoreTarget.href}>
                        {scoreTarget.id}
                      </Link>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td>{score.source}</td>
                  <td>{formatDate(score.createdAt)}</td>
                  <td>{score.comment ?? "—"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}
