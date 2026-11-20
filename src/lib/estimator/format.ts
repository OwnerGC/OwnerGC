/** $870,127 */
export function money(v: number): string {
  const sign = v < 0 ? "−" : "";
  return `${sign}$${Math.round(Math.abs(v)).toLocaleString("en-US")}`;
}

/** $870k, or $1.23M from a million up. */
export function shortMoney(v: number): string {
  const a = Math.abs(v);
  const sign = v < 0 ? "−" : "";
  return a >= 1e6 ? `${sign}$${(a / 1e6).toFixed(2)}M` : `${sign}$${Math.round(a / 1000)}k`;
}

export function percent(share: number): string {
  return `${Math.round(share * 100)}%`;
}
