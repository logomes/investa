"""Quote providers for asset tickers (BR + US markets).

Pure data layer: each provider returns a Quote on success or None on any
failure (timeout, HTTP error, parse error, missing data). The ProviderChain
walks providers in order and returns the first successful Quote.

Why None instead of raising: the chain composes providers and a single
provider failure is expected behavior — exceptions would force the chain
to translate them back into None.
"""
from __future__ import annotations

import csv
import io
import logging
from abc import ABC, abstractmethod
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Literal

import requests

logger = logging.getLogger(__name__)

Market = Literal["BR", "US"]
DEFAULT_TIMEOUT = 3.0
USER_AGENT = "Mozilla/5.0 (compatible; investa/1.0; +https://investa-beta.vercel.app)"


@dataclass(slots=True, frozen=True)
class Quote:
    price: float
    currency: str
    as_of: datetime
    source: str


class QuoteProvider(ABC):
    name: str

    @abstractmethod
    def fetch(self, ticker: str, market: Market) -> Quote | None: ...


class BrapiProvider(QuoteProvider):
    """BRAPI (https://brapi.dev) — BR market only.

    Free, no auth. URL: https://brapi.dev/api/quote/PETR4
    """

    name = "brapi"

    def fetch(self, ticker: str, market: Market) -> Quote | None:
        if market != "BR":
            return None
        url = f"https://brapi.dev/api/quote/{ticker.upper()}"
        try:
            resp = requests.get(url, headers={"User-Agent": USER_AGENT}, timeout=DEFAULT_TIMEOUT)
            resp.raise_for_status()
            data = resp.json()
        except (requests.RequestException, ValueError) as e:
            logger.info("brapi fetch failed for %s: %s", ticker, e)
            return None

        results = data.get("results") or []
        if not results:
            return None
        row = results[0]
        price = row.get("regularMarketPrice")
        currency = row.get("currency") or "BRL"
        as_of_raw = row.get("regularMarketTime")
        if price is None or as_of_raw is None:
            return None

        try:
            as_of = datetime.fromisoformat(as_of_raw.replace("Z", "+00:00"))
        except (TypeError, ValueError):
            return None

        return Quote(price=float(price), currency=currency, as_of=as_of, source=self.name)


class YahooProvider(QuoteProvider):
    """Yahoo Finance chart endpoint — BR (with .SA suffix) and US.

    No auth needed when sending a User-Agent header.
    URL: https://query1.finance.yahoo.com/v8/finance/chart/{symbol}?interval=1d&range=1d
    """

    name = "yahoo"

    def fetch(self, ticker: str, market: Market) -> Quote | None:
        symbol = f"{ticker.upper()}.SA" if market == "BR" else ticker.upper()
        url = f"https://query1.finance.yahoo.com/v8/finance/chart/{symbol}?interval=1d&range=1d"
        try:
            resp = requests.get(url, headers={"User-Agent": USER_AGENT}, timeout=DEFAULT_TIMEOUT)
            resp.raise_for_status()
            data = resp.json()
        except (requests.RequestException, ValueError) as e:
            logger.info("yahoo fetch failed for %s: %s", symbol, e)
            return None

        result = (data.get("chart") or {}).get("result") or []
        if not result:
            return None
        meta = result[0].get("meta") or {}
        price = meta.get("regularMarketPrice")
        currency = meta.get("currency") or ("BRL" if market == "BR" else "USD")
        as_of_epoch = meta.get("regularMarketTime")
        if price is None or as_of_epoch is None:
            return None

        try:
            as_of = datetime.fromtimestamp(int(as_of_epoch), tz=timezone.utc)
        except (TypeError, ValueError, OSError):
            return None

        return Quote(price=float(price), currency=currency, as_of=as_of, source=self.name)


class StooqProvider(QuoteProvider):
    """Stooq CSV endpoint — best for US tickers (returns N/D for many BR ones).

    URL: https://stooq.com/q/l/?s=aapl.us&f=sd2t2ohlcv&h&e=csv
    """

    name = "stooq"

    def fetch(self, ticker: str, market: Market) -> Quote | None:
        suffix = ".sa" if market == "BR" else ".us"
        symbol = f"{ticker.lower()}{suffix}"
        url = f"https://stooq.com/q/l/?s={symbol}&f=sd2t2ohlcv&h&e=csv"
        try:
            resp = requests.get(url, headers={"User-Agent": USER_AGENT}, timeout=DEFAULT_TIMEOUT)
            resp.raise_for_status()
            text = resp.text
        except requests.RequestException as e:
            logger.info("stooq fetch failed for %s: %s", symbol, e)
            return None

        try:
            reader = csv.DictReader(io.StringIO(text))
            row = next(reader, None)
        except csv.Error:
            return None
        if row is None:
            return None

        close = row.get("Close")
        date_s = row.get("Date")
        time_s = row.get("Time") or "00:00:00"
        if not close or close == "N/D" or not date_s or date_s == "N/D":
            return None
        try:
            as_of = datetime.fromisoformat(f"{date_s}T{time_s}").replace(tzinfo=timezone.utc)
            price = float(close)
        except (TypeError, ValueError):
            return None

        currency = "BRL" if market == "BR" else "USD"
        return Quote(price=price, currency=currency, as_of=as_of, source=self.name)


# Provider chain per market: tries each in order, returns first successful Quote.
_BR_CHAIN: tuple[QuoteProvider, ...] = (BrapiProvider(), YahooProvider())
_US_CHAIN: tuple[QuoteProvider, ...] = (YahooProvider(), StooqProvider())


def get_quote_from_chain(ticker: str, market: Market) -> Quote | None:
    """Walk the chain for `market` and return the first non-None Quote."""
    chain = _BR_CHAIN if market == "BR" else _US_CHAIN
    for provider in chain:
        quote = provider.fetch(ticker, market)
        if quote is not None:
            return quote
    return None
