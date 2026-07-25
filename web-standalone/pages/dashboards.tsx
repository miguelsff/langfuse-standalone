import { useState, type FormEvent } from "react";
import { PageHeader } from "@/components/page-header";
import { api } from "@/utils/api";
import { formatCost, formatNumber } from "@/utils/format";

const metricLabels = {
  traceCount: "Traces",
  observationCount: "Observations",
  sessionCount: "Sessions",
  totalCost: "Total cost",
  errorCount: "Errors",
  averageLatencyMs: "Average latency",
} as const;

type Metric = keyof typeof metricLabels;

export default function DashboardsPage() {
  const [name, setName] = useState("");
  const [widgetTitle, setWidgetTitle] = useState("");
  const [metric, setMetric] = useState<Metric>("traceCount");
  const [dashboardId, setDashboardId] = useState("");
  const utilities = api.useUtils();
  const dashboards = api.dashboards.list.useQuery();
  const metrics = api.dashboards.metrics.useQuery();
  const refresh = () => utilities.dashboards.list.invalidate();
  const create = api.dashboards.create.useMutation({
    onSuccess: async (dashboard) => {
      setName("");
      setDashboardId(dashboard.id);
      await refresh();
    },
  });
  const remove = api.dashboards.delete.useMutation({ onSuccess: refresh });
  const addWidget = api.dashboards.addWidget.useMutation({
    onSuccess: async () => {
      setWidgetTitle("");
      await refresh();
    },
  });
  const deleteWidget = api.dashboards.deleteWidget.useMutation({
    onSuccess: refresh,
  });

  const submitDashboard = (event: FormEvent) => {
    event.preventDefault();
    if (name.trim()) create.mutate({ name });
  };
  const submitWidget = (event: FormEvent) => {
    event.preventDefault();
    if (dashboardId && widgetTitle.trim()) {
      addWidget.mutate({
        dashboardId,
        title: widgetTitle,
        metric,
        chartType: "NUMBER",
      });
    }
  };
  const displayMetric = (value: Metric) => {
    const raw = metrics.data?.[value] ?? 0;
    if (value === "totalCost") return formatCost(raw);
    if (value === "averageLatencyMs") return `${formatNumber(raw)} ms`;
    return formatNumber(raw);
  };

  return (
    <>
      <PageHeader
        description="Dashboard definitions are persisted in SQLite; values come from JSON."
        title="Dashboards"
      />
      <section className="card">
        <h2>Create dashboard</h2>
        <form className="inline-form" onSubmit={submitDashboard}>
          <input
            onChange={(event) => setName(event.target.value)}
            placeholder="Dashboard name"
            value={name}
          />
          <button className="button">Create</button>
        </form>
      </section>
      <section className="card" style={{ marginTop: "1rem" }}>
        <h2>Add widget</h2>
        <form className="form-grid" onSubmit={submitWidget}>
          <label>
            Dashboard
            <select
              onChange={(event) => setDashboardId(event.target.value)}
              value={dashboardId}
            >
              <option value="">Select a dashboard</option>
              {dashboards.data?.map((dashboard) => (
                <option key={dashboard.id} value={dashboard.id}>
                  {dashboard.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Title
            <input
              onChange={(event) => setWidgetTitle(event.target.value)}
              value={widgetTitle}
            />
          </label>
          <label>
            Metric
            <select
              onChange={(event) => setMetric(event.target.value as Metric)}
              value={metric}
            >
              {Object.entries(metricLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <button className="button">Add widget</button>
        </form>
      </section>
      <div className="stack" style={{ marginTop: "1rem" }}>
        {dashboards.data?.map((dashboard) => (
          <section className="card" key={dashboard.id}>
            <div className="section-heading">
              <h2>{dashboard.name}</h2>
              <button
                className="text-button danger-text"
                onClick={() => remove.mutate({ id: dashboard.id })}
                type="button"
              >
                Delete dashboard
              </button>
            </div>
            {dashboard.widgets.length === 0 ? (
              <p className="muted">No widgets yet.</p>
            ) : (
              <div className="metrics-grid">
                {dashboard.widgets.map((widget) => (
                  <article className="card metric" key={widget.id}>
                    <small>{widget.title}</small>
                    <strong>{displayMetric(widget.metric as Metric)}</strong>
                    <button
                      className="text-button danger-text"
                      onClick={() => deleteWidget.mutate({ id: widget.id })}
                      type="button"
                    >
                      Remove
                    </button>
                  </article>
                ))}
              </div>
            )}
          </section>
        ))}
      </div>
    </>
  );
}
