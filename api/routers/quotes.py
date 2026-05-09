"""GET /api/quotes — current price for a ticker via the provider chain."""
from __future__ import annotations

import re

from fastapi import APIRouter, HTTPException, Query

from core.services.quotes import get_quote
from schemas.outputs import QuoteOut

router = APIRouter()

TICKER_PATTERN = re.compile(r"^[A-Za-z0-9.]{1,12}$")


@router.get("/api/quotes", response_model=QuoteOut)
def quotes(
    ticker: str = Query(..., description="Asset ticker, e.g. PETR4 or AAPL"),
    market: str = Query(..., pattern="^(BR|US)$", description="BR or US"),
) -> QuoteOut:
    """Return current quote for `ticker` in `market`. 404 if no provider answers."""
    if not TICKER_PATTERN.match(ticker):
        raise HTTPException(status_code=422, detail="invalid ticker format")

    quote = get_quote(ticker, market)  # type: ignore[arg-type]
    if quote is None:
        raise HTTPException(status_code=404, detail="quote not found")

    return QuoteOut(
        ticker=ticker.upper(),
        market=market,  # type: ignore[arg-type]
        price=quote.price,
        currency=quote.currency,
        as_of=quote.as_of,
        source=quote.source,
    )
