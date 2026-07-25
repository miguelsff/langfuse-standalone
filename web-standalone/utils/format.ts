export const formatDate = (value: string | Date | null | undefined) =>
  value
    ? new Intl.DateTimeFormat(undefined, {
        dateStyle: "medium",
        timeStyle: "medium",
      }).format(new Date(value))
    : "—";

export const formatNumber = (value: number, maximumFractionDigits = 2) =>
  new Intl.NumberFormat(undefined, { maximumFractionDigits }).format(value);

export const formatCost = (value: number | null | undefined) =>
  value == null
    ? "—"
    : new Intl.NumberFormat(undefined, {
        style: "currency",
        currency: "USD",
        maximumFractionDigits: 6,
      }).format(value);
