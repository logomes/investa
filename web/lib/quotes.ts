import type { QuoteOut } from "./api-types";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export class QuoteNotFoundError extends Error {
  constructor() {
    super("Cotação não encontrada");
    this.name = "QuoteNotFoundError";
  }
}

export async function fetchQuote(ticker: string, market: "BR" | "US"): Promise<QuoteOut> {
  const url = `${API_URL}/api/quotes?ticker=${encodeURIComponent(ticker)}&market=${market}`;
  const res = await fetch(url);
  if (res.status === 404) throw new QuoteNotFoundError();
  if (!res.ok) throw new Error(`API ${res.status}`);
  return (await res.json()) as QuoteOut;
}
