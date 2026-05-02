"""Macro indicators service: cached fetch with fallback.

Server-side TTL cache (1h) replacing the Streamlit caching used in the
original Streamlit project. Falls back to MACRO_FALLBACK on any BCB error.
"""
from __future__ import annotations

from cachetools import TTLCache, cached

from ..config import MACRO_FALLBACK, MacroParams
from ..data_sources.bcb import BcbApiError, fetch_macro


_CACHE: TTLCache = TTLCache(maxsize=1, ttl=3600)  # 1 hour


@cached(_CACHE)
def get_macro_params() -> MacroParams:
    """Single fetch attempt cached for 1h; fall back on any BcbApiError."""
    try:
        reading = fetch_macro()
    except BcbApiError:
        return MACRO_FALLBACK

    return MacroParams(
        selic=reading.selic,
        ipca=reading.ipca_12m,
        cdi=reading.cdi,
        usd_brl=reading.usd_brl,
        is_stale=False,
        source_label="BCB SGS (live)",
    )


def clear_cache() -> None:
    """For tests — clear the TTL cache."""
    _CACHE.clear()
