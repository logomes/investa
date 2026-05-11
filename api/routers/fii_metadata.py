"""GET /api/fii-metadata — curated FII subtype lookup.

V1: serves a hand-curated JSON table covering ~80% of FII trading volume.
V2 (future): replaces the JSON with a CVM ETL job that downloads
`inf_mensal_fii_YYYYMM.zip` from `dados.cvm.gov.br/dados/FII/`, extracts the
`Segmento` field per CNPJ, and maps it into our subtype taxonomy. The
endpoint signature stays the same, so the frontend doesn't change.

The endpoint shape is intentionally a flat dict so callers can build their
own local index in O(1). Cached for 1h server-side since the data is
quasi-static.
"""
from __future__ import annotations

import json
from pathlib import Path

from cachetools import TTLCache, cached
from fastapi import APIRouter

router = APIRouter()

DATA_PATH = Path(__file__).parent.parent / "data" / "fii_subtypes.json"


@cached(cache=TTLCache(maxsize=1, ttl=3600))
def _load_subtypes() -> dict[str, str]:
    """Read the curated JSON and strip the `_meta` key — callers want a flat lookup."""
    with DATA_PATH.open("r", encoding="utf-8") as f:
        raw = json.load(f)
    return {k: v for k, v in raw.items() if not k.startswith("_")}


@router.get("/api/fii-metadata")
def fii_metadata() -> dict[str, object]:
    """Return the curated ticker → subtype mapping plus metadata.

    Shape:
      {
        "subtypes": { "MXRF11": "papel", ... },
        "count": 61,
        "source": "curated"
      }

    Returns the full table in one response (small payload, <5kb). The
    frontend should cache aggressively since it changes at most quarterly.
    """
    subtypes = _load_subtypes()
    return {
        "subtypes": subtypes,
        "count": len(subtypes),
        "source": "curated",
    }
