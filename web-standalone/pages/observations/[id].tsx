import Link from "next/link";
import { useRouter } from "next/router";
import { AnnotationsPanel } from "@/components/annotations-panel";
import { JsonValue } from "@/components/json-value";
import { PageHeader } from "@/components/page-header";
import { api } from "@/utils/api";
import { formatDate } from "@/utils/format";

export default function ObservationDetailPage() {
  const router = useRouter();
  const id = typeof router.query.id === "string" ? router.query.id : "";
  const detail = api.observations.detail.useQuery(
    { id },
    { enabled: Boolean(id) },
  );
  if (detail.isLoading) return <p>Loading observation…</p>;
  if (detail.error) return <div className="error-box">{detail.error.message}</div>;
  if (!detail.data) return null;
  const { observation, trace } = detail.data;

  return (
    <>
      <PageHeader
        description={`${observation.id} · ${formatDate(observation.startTime)}`}
        title={observation.name || observation.type}
      />
      <section className="detail-grid">
        <article className="card">
          <small>Type</small>
          <p>{observation.type}</p>
          <small>Trace</small>
          <p>
            <Link
              className="link"
              href={`/project/local/traces/${observation.traceId}`}
            >
              {trace?.name || observation.traceId}
            </Link>
          </p>
          <small>Parent observation</small>
          <p>{observation.parentObservationId ?? "—"}</p>
        </article>
        <article className="card">
          <small>Model</small>
          <p>{observation.model ?? "—"}</p>
          <small>End time</small>
          <p>{formatDate(observation.endTime)}</p>
          <small>Level</small>
          <p>{observation.level}</p>
        </article>
        <article className="card">
          <h2>Input</h2>
          <JsonValue value={observation.input} />
        </article>
        <article className="card">
          <h2>Output</h2>
          <JsonValue value={observation.output} />
        </article>
        <article className="card">
          <h2>Usage</h2>
          <JsonValue value={observation.usage} />
        </article>
        <article className="card">
          <h2>Cost</h2>
          <JsonValue value={observation.cost} />
        </article>
        <article className="card wide">
          <h2>Metadata</h2>
          <JsonValue value={observation.metadata} />
        </article>
      </section>
      <AnnotationsPanel targetId={observation.id} targetType="OBSERVATION" />
    </>
  );
}
