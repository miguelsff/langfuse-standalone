import { useMemo, useState, type FormEvent } from "react";
import { PageHeader } from "@/components/page-header";
import { api } from "@/utils/api";
import { formatDate } from "@/utils/format";

type TargetType = "TRACE" | "OBSERVATION" | "SESSION";
type DataType = "NUMERIC" | "BOOLEAN" | "CATEGORICAL";

export default function EvaluatorsPage() {
  const [templateName, setTemplateName] = useState("");
  const [prompt, setPrompt] = useState(
    "Evaluate the following input and output. Return a score and a short reason.\n\nInput:\n{{input}}\n\nOutput:\n{{output}}",
  );
  const [scoreName, setScoreName] = useState("quality");
  const [dataType, setDataType] = useState<DataType>("NUMERIC");
  const [connectionId, setConnectionId] = useState("");
  const [model, setModel] = useState("");
  const [configurationName, setConfigurationName] = useState("");
  const [templateId, setTemplateId] = useState("");
  const [targetType, setTargetType] = useState<TargetType>("TRACE");
  const [configurationId, setConfigurationId] = useState("");
  const [search, setSearch] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [confirmedCount, setConfirmedCount] = useState<number | null>(null);
  const [message, setMessage] = useState("");

  const utilities = api.useUtils();
  const connections = api.connections.list.useQuery();
  const templates = api.evaluations.templates.useQuery();
  const configurations = api.evaluations.configurations.useQuery();
  const runs = api.evaluations.runs.useQuery(undefined, {
    refetchInterval: 2_000,
  });
  const selectedConfiguration = configurations.data?.find(
    (item) => item.id === configurationId,
  );
  const scopeType = (selectedConfiguration?.targetType ?? "TRACE") as TargetType;
  const traces = api.traces.list.useQuery(
    { page: 1, limit: 200, filters: { search: search || undefined } },
    { enabled: scopeType === "TRACE" },
  );
  const observations = api.observations.list.useQuery(
    { page: 1, limit: 200 },
    { enabled: scopeType === "OBSERVATION" },
  );
  const sessions = api.sessions.list.useQuery(undefined, {
    enabled: scopeType === "SESSION",
  });
  const visibleTargets = useMemo(() => {
    if (scopeType === "TRACE") {
      return (traces.data?.items ?? []).map((item) => ({
        id: item.id,
        label: item.name || item.id,
      }));
    }
    if (scopeType === "OBSERVATION") {
      return (observations.data?.items ?? []).map((item) => ({
        id: item.id,
        label: item.name || item.id,
      }));
    }
    return (sessions.data ?? []).map((item) => ({
      id: item.id,
      label: item.id,
    }));
  }, [observations.data, scopeType, sessions.data, traces.data]);

  const createTemplate = api.evaluations.createTemplate.useMutation({
    onSuccess: async (created) => {
      setTemplateName("");
      setTemplateId(created.id);
      setMessage("Template created.");
      await utilities.evaluations.templates.invalidate();
    },
  });
  const createConfiguration =
    api.evaluations.createConfiguration.useMutation({
      onSuccess: async (created) => {
        setConfigurationName("");
        setConfigurationId(created.id);
        setSelectedIds(new Set());
        setConfirmedCount(null);
        setMessage("Configuration created.");
        await utilities.evaluations.configurations.invalidate();
      },
    });
  const preview = api.evaluations.preview.useMutation({
    onSuccess: (result) => {
      setConfirmedCount(result.count);
      setMessage(
        `${result.count} ${result.targetType.toLowerCase()} targets are ready. Confirm by starting the run.`,
      );
    },
    onError: (error) => setMessage(error.message),
  });
  const enqueue = api.evaluations.enqueue.useMutation({
    onSuccess: async () => {
      setConfirmedCount(null);
      setSelectedIds(new Set());
      setMessage("Manual evaluation run started.");
      await utilities.evaluations.runs.invalidate();
    },
    onError: (error) => {
      setConfirmedCount(null);
      setMessage(error.message);
    },
  });
  const cancel = api.evaluations.cancel.useMutation({
    onSuccess: () => utilities.evaluations.runs.invalidate(),
  });

  const scope = {
    configurationId,
    selectedIds: selectedIds.size > 0 ? [...selectedIds] : undefined,
    filters:
      selectedIds.size === 0 && scopeType === "TRACE"
        ? { search: search || undefined }
        : undefined,
  };

  const submitTemplate = (event: FormEvent) => {
    event.preventDefault();
    createTemplate.mutate({
      name: templateName,
      prompt,
      scoreName,
      dataType,
      connectionId: connectionId || null,
      model: model || null,
      modelParameters: {},
    });
  };
  const submitConfiguration = (event: FormEvent) => {
    event.preventDefault();
    createConfiguration.mutate({
      name: configurationName,
      templateId,
      targetType,
      variableMapping: {},
    });
  };
  const toggleSelected = (id: string) => {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    setConfirmedCount(null);
  };

  return (
    <>
      <PageHeader
        description="Evaluators run only when you explicitly preview and confirm a scope."
        title="LLM-as-a-judge"
      />
      <section className="card">
        <h2>1. Create evaluator template</h2>
        <form className="stack" onSubmit={submitTemplate}>
          <div className="form-grid">
            <label>
              Template name
              <input
                onChange={(event) => setTemplateName(event.target.value)}
                required
                value={templateName}
              />
            </label>
            <label>
              Connection
              <select
                onChange={(event) => setConnectionId(event.target.value)}
                required
                value={connectionId}
              >
                <option value="">Select a connection</option>
                {connections.data?.map((connection) => (
                  <option key={connection.id} value={connection.id}>
                    {connection.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Model ID
              <input
                onChange={(event) => setModel(event.target.value)}
                placeholder="gpt-4.1-mini"
                required
                value={model}
              />
            </label>
            <label>
              Score name
              <input
                onChange={(event) => setScoreName(event.target.value)}
                required
                value={scoreName}
              />
            </label>
            <label>
              Score type
              <select
                onChange={(event) =>
                  setDataType(event.target.value as DataType)
                }
                value={dataType}
              >
                <option value="NUMERIC">Numeric</option>
                <option value="BOOLEAN">Boolean</option>
                <option value="CATEGORICAL">Categorical</option>
              </select>
            </label>
          </div>
          <label>
            Prompt
            <textarea
              onChange={(event) => setPrompt(event.target.value)}
              rows={8}
              value={prompt}
            />
          </label>
          <small>
            Variables use double braces, for example: input, output, metadata,
            or any dotted JSON path.
          </small>
          <button className="button" disabled={createTemplate.isPending}>
            Create template
          </button>
        </form>
      </section>

      <section className="card" style={{ marginTop: "1rem" }}>
        <h2>2. Create configuration</h2>
        <form className="form-grid" onSubmit={submitConfiguration}>
          <label>
            Configuration name
            <input
              onChange={(event) => setConfigurationName(event.target.value)}
              required
              value={configurationName}
            />
          </label>
          <label>
            Template
            <select
              onChange={(event) => setTemplateId(event.target.value)}
              required
              value={templateId}
            >
              <option value="">Select a template</option>
              {templates.data?.map((template) => (
                <option key={template.id} value={template.id}>
                  {template.name} · v{template.version}
                </option>
              ))}
            </select>
          </label>
          <label>
            Target type
            <select
              onChange={(event) =>
                setTargetType(event.target.value as TargetType)
              }
              value={targetType}
            >
              <option value="TRACE">Trace</option>
              <option value="OBSERVATION">Observation</option>
              <option value="SESSION">Session</option>
            </select>
          </label>
          <button className="button" disabled={createConfiguration.isPending}>
            Create configuration
          </button>
        </form>
      </section>

      <section className="card" style={{ marginTop: "1rem" }}>
        <h2>3. Select scope and run manually</h2>
        <div className="form-grid">
          <label>
            Configuration
            <select
              onChange={(event) => {
                setConfigurationId(event.target.value);
                setSelectedIds(new Set());
                setConfirmedCount(null);
              }}
              value={configurationId}
            >
              <option value="">Select a configuration</option>
              {configurations.data?.map((configuration) => (
                <option key={configuration.id} value={configuration.id}>
                  {configuration.name} · {configuration.targetType}
                </option>
              ))}
            </select>
          </label>
          {scopeType === "TRACE" ? (
            <label>
              Filter traces
              <input
                onChange={(event) => {
                  setSearch(event.target.value);
                  setSelectedIds(new Set());
                  setConfirmedCount(null);
                }}
                placeholder="Name, ID, user or session"
                value={search}
              />
            </label>
          ) : null}
        </div>
        {configurationId ? (
          <>
            <p className="muted">
              Select individual visible rows, or select none to evaluate the
              complete filtered batch.
            </p>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Select</th>
                    <th>Target</th>
                    <th>ID</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleTargets.map((target) => (
                    <tr key={target.id}>
                      <td>
                        <input
                          aria-label={`Select ${target.id}`}
                          checked={selectedIds.has(target.id)}
                          onChange={() => toggleSelected(target.id)}
                          type="checkbox"
                        />
                      </td>
                      <td>{target.label}</td>
                      <td>{target.id}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="actions" style={{ marginTop: "1rem" }}>
              <button
                className="button secondary"
                disabled={preview.isPending}
                onClick={() => preview.mutate(scope)}
                type="button"
              >
                Preview target count
              </button>
              <button
                className="button"
                disabled={confirmedCount === null || enqueue.isPending}
                onClick={() => {
                  if (confirmedCount !== null) {
                    enqueue.mutate({ ...scope, confirmedCount });
                  }
                }}
                type="button"
              >
                {confirmedCount === null
                  ? "Confirm scope first"
                  : `Start run for ${confirmedCount} targets`}
              </button>
            </div>
          </>
        ) : null}
        {message ? <p>{message}</p> : null}
      </section>

      <section style={{ marginTop: "1.5rem" }}>
        <h2>Run history</h2>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Configuration</th>
                <th>Status</th>
                <th>Progress</th>
                <th>Created</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {runs.data?.map((run) => (
                <tr key={run.id}>
                  <td>
                    {run.configuration.name}
                    <br />
                    <small>{run.id}</small>
                  </td>
                  <td>{run.status}</td>
                  <td>
                    {run.completedCount + run.failedCount}/{run.requestedCount}
                    {run.failedCount > 0 ? ` · ${run.failedCount} failed` : ""}
                  </td>
                  <td>{formatDate(run.createdAt)}</td>
                  <td>
                    {["PENDING", "RUNNING"].includes(run.status) ? (
                      <button
                        className="text-button danger-text"
                        onClick={() => cancel.mutate({ id: run.id })}
                        type="button"
                      >
                        Cancel
                      </button>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
