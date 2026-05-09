"""Quote service with TTL cache layered on top of the provider chain."""
from __future__ import annotations

from cachetools import TTLCache, cached
from cachetools.keys import hashkey

from ..data_sources.quotes import Market, Quote, get_quote_from_chain


_CACHE: TTLCache = TTLCache(maxsize=512, ttl=60)


@cached(_CACHE, key=lambda ticker, market: hashkey(ticker.upper(), market))
def get_quote(ticker: str, market: Market) -> Quote | None:
    """Cached fetch via the provider chain. Caches None too — prevents
    spamming providers when a ticker doesn't exist."""
    return get_quote_from_chain(ticker, market)


def clear_cache() -> None:
    """For tests."""
    _CACHE.clear()
