export function JsonValue({
  value,
  empty = "—",
}: {
  value: unknown;
  empty?: string;
}) {
  if (value === undefined || value === null) {
    return <span className="muted">{empty}</span>;
  }
  return (
    <pre className="json-value">
      {typeof value === "string" ? value : JSON.stringify(value, null, 2)}
    </pre>
  );
}
