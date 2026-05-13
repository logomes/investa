"""GET /api/sector-metadata — curated ticker → sector lookup.

Mirrors the pattern of `fii_metadata.py`. V1 serves a hand-curated JSON
table covering ~100 most-traded Brazilian tickers (loosely follows B3's
"Setor Econômico" / ICB classification, flattened to ~20 buckets).

V2 (future): replace the JSON with a B3/CVM ETL that maps CNPJ → CNAE →
sector taxonomy. Endpoint shape stays stable.
"""
from __future__ import annotations

import json
from pathlib import Path

from cachetools import TTLCache, cached
from fastapi import APIRouter

router = APIRouter()

DATA_PATH = Path(__file__).parent.parent / "data" / "sector_mapping.json"


@cached(cache=TTLCache(maxsize=1, ttl=3600))
def _load_sectors() -> dict[str, str]:
    with DATA_PATH.open("r", encoding="utf-8") as f:
        raw = json.load(f)
    return {k: v for k, v in raw.items() if not k.startswith("_")}


@router.get("/api/sector-metadata")
def sector_metadata() -> dict[str, object]:
    """Return curated ticker → sector mapping plus metadata.

    Shape:
      {
        "sectors": { "PETR4": "Petróleo & Gás", ... },
        "count": 100,
        "source": "curated"
      }
    """
    sectors = _load_sectors()
    return {
        "sectors": sectors,
        "count": len(sectors),
        "source": "curated",
    }
