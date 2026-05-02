const BRL_FORMATTER = new Intl.NumberFormat("pt-BR", {
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

const BRL_FORMATTER_2 = new Intl.NumberFormat("pt-BR", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function formatRsK(value: number): string {
  const k = Math.round(value / 1000);
  return `R$ ${BRL_FORMATTER.format(k)}k`;
}

export function formatRs(value: number): string {
  return `R$ ${BRL_FORMATTER.format(Math.round(value))}`;
}

export function formatRs2(value: number): string {
  return `R$ ${BRL_FORMATTER_2.format(value)}`;
}

export function formatPercent(decimal: number, fractionDigits = 1): string {
  const pct = decimal * 100;
  const sign = pct < 0 ? "-" : "";
  const abs = Math.abs(pct).toFixed(fractionDigits).replace(".", ",");
  return `${sign}${abs}%`;
}

export function formatSignedDelta(
  value: number,
  kind: "currency" | "percent",
): string {
  if (kind === "currency") {
    const sign = value >= 0 ? "+" : "-";
    return `${sign}R$ ${BRL_FORMATTER.format(Math.round(Math.abs(value)))}`;
  }
  // percent
  const pct = value * 100;
  const sign = pct >= 0 ? "+" : "-";
  const abs = Math.abs(pct).toFixed(2).replace(".", ",");
  return `${sign}${abs}% a.a.`;
}
