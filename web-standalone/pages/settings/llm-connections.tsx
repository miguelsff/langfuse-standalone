import { useState, type FormEvent } from "react";
import { PageHeader } from "@/components/page-header";
import { api } from "@/utils/api";
import { formatDate } from "@/utils/format";

const adapters = [
  ["OPENAI", "OpenAI"],
  ["OPENAI_COMPATIBLE", "OpenAI compatible"],
  ["ANTHROPIC", "Anthropic"],
  ["AZURE_OPENAI", "Azure OpenAI"],
  ["GOOGLE_AI", "Google AI Studio"],
  ["AMAZON_BEDROCK", "Amazon Bedrock"],
  ["GOOGLE_VERTEX", "Google Vertex AI"],
] as const;

type Adapter = (typeof adapters)[number][0];

const parseObject = (value: string, label: string) => {
  if (!value.trim()) return {};
  const parsed: unknown = JSON.parse(value);
  if (!parsed || Array.isArray(parsed) || typeof parsed !== "object") {
    throw new Error(`${label} must be a JSON object`);
  }
  return parsed as Record<string, unknown>;
};

export default function LlmConnectionsPage() {
  const [name, setName] = useState("");
  const [adapter, setAdapter] = useState<Adapter>("OPENAI");
  const [apiKey, setApiKey] = useState("");
  const [baseUrl, setBaseUrl] = useState("");
  const [headers, setHeaders] = useState("");
  const [config, setConfig] = useState("");
  const [formError, setFormError] = useState("");
  const utilities = api.useUtils();
  const connections = api.connections.list.useQuery();
  const create = api.connections.create.useMutation({
    onSuccess: async () => {
      setName("");
      setApiKey("");
      setBaseUrl("");
      setHeaders("");
      setConfig("");
      setFormError("");
      await utilities.connections.list.invalidate();
    },
    onError: (error) => setFormError(error.message),
  });
  const remove = api.connections.delete.useMutation({
    onSuccess: () => utilities.connections.list.invalidate(),
  });

  const submit = (event: FormEvent) => {
    event.preventDefault();
    try {
      const parsedHeaders = parseObject(headers, "Headers");
      const parsedConfig = parseObject(config, "Configuration");
      if (
        Object.values(parsedHeaders).some(
          (value) => typeof value !== "string",
        )
      ) {
        throw new Error("Every custom header value must be a string");
      }
      setFormError("");
      create.mutate({
        name,
        provider:
          adapters.find(([value]) => value === adapter)?.[1] ?? adapter,
        adapter,
        apiKey,
        baseUrl: baseUrl || null,
        headers: parsedHeaders as Record<string, string>,
        config: parsedConfig,
      });
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "Invalid form");
    }
  };

  return (
    <>
      <PageHeader
        description="Credentials are encrypted in local SQLite. Custom endpoints must use public HTTPS addresses."
        title="LLM connections"
      />
      <section className="card">
        <h2>Add connection</h2>
        <form className="stack" onSubmit={submit}>
          <div className="form-grid">
            <label>
              Name
              <input
                onChange={(event) => setName(event.target.value)}
                required
                value={name}
              />
            </label>
            <label>
              Provider
              <select
                onChange={(event) => setAdapter(event.target.value as Adapter)}
                value={adapter}
              >
                {adapters.map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              API key or provider token
              <input
                autoComplete="new-password"
                onChange={(event) => setApiKey(event.target.value)}
                required
                type="password"
                value={apiKey}
              />
            </label>
            <label>
              Custom base URL
              <input
                onChange={(event) => setBaseUrl(event.target.value)}
                placeholder="https://provider.example/v1"
                type="url"
                value={baseUrl}
              />
            </label>
          </div>
          <label>
            Custom headers (JSON object)
            <textarea
              onChange={(event) => setHeaders(event.target.value)}
              placeholder='{"X-Custom-Header":"value"}'
              rows={3}
              value={headers}
            />
          </label>
          <label>
            Provider configuration (JSON object)
            <textarea
              onChange={(event) => setConfig(event.target.value)}
              placeholder='{"region":"us-east-1"}'
              rows={3}
              value={config}
            />
          </label>
          {formError ? <div className="error-box">{formError}</div> : null}
          <button className="button" disabled={create.isPending}>
            Save encrypted connection
          </button>
        </form>
      </section>
      <section style={{ marginTop: "1.5rem" }}>
        <h2>Saved connections</h2>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Provider</th>
                <th>Base URL</th>
                <th>Credential</th>
                <th>Updated</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {connections.data?.map((connection) => (
                <tr key={connection.id}>
                  <td>{connection.name}</td>
                  <td>{connection.provider}</td>
                  <td>{connection.baseUrl ?? "Provider default"}</td>
                  <td>{connection.hasApiKey ? "Encrypted" : "Missing"}</td>
                  <td>{formatDate(connection.updatedAt)}</td>
                  <td>
                    <button
                      className="text-button danger-text"
                      onClick={() => remove.mutate({ id: connection.id })}
                      type="button"
                    >
                      Delete
                    </button>
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
