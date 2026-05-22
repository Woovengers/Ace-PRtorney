const RELATIVE_UNITS = [
  ["d", 24 * 60 * 60 * 1000],
  ["h", 60 * 60 * 1000],
  ["m", 60 * 1000],
];

export function formatNumber(value) {
  if (value === null || value === undefined || Number.isNaN(value)) return "-";
  return new Intl.NumberFormat("en-US").format(value);
}

export function formatShortDate(iso) {
  if (!iso) return "-";
  const date = new Date(iso);
  return `${String(date.getMonth() + 1).padStart(2, "0")}/${String(date.getDate()).padStart(2, "0")}`;
}

export function relativeTime(iso) {
  if (!iso) return "-";
  const diff = Math.max(Date.now() - new Date(iso).getTime(), 0);
  for (const [label, unitMs] of RELATIVE_UNITS) {
    if (diff >= unitMs) return `${Math.floor(diff / unitMs)}${label} ago`;
  }
  return "now";
}
