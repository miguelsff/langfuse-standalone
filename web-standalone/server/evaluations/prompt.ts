const getPath = (value: unknown, path: string): unknown => {
  if (!path) return value;
  return path.split(".").reduce<unknown>((current, segment) => {
    if (
      current &&
      typeof current === "object" &&
      segment in (current as Record<string, unknown>)
    ) {
      return (current as Record<string, unknown>)[segment];
    }
    return undefined;
  }, value);
};

const printable = (value: unknown) => {
  if (typeof value === "string") return value;
  if (value === undefined) return "";
  return JSON.stringify(value, null, 2);
};

export const renderEvaluationPrompt = (
  template: string,
  snapshot: unknown,
  variableMapping: Record<string, string>,
) =>
  template.replace(/\{\{\s*([a-zA-Z0-9_.-]+)\s*\}\}/g, (_match, name) => {
    const path = variableMapping[name] ?? name;
    return printable(getPath(snapshot, path));
  });
