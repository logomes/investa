"""GET /api/macro — current Brazilian macro indicators."""
from fastapi import APIRouter

from core.services.macro import get_macro_params
from schemas.outputs import MacroOut

router = APIRouter()


@router.get("/api/macro", response_model=MacroOut)
def macro() -> MacroOut:
    """Return Selic, CDI, IPCA, USD/BRL — live from BCB or cached fallback.

    The underlying core.services.macro.get_macro_params is itself cached
    via cachetools.TTLCache(ttl=3600), so this endpoint is essentially free.
    """
    m = get_macro_params()
    return MacroOut(
        selic=m.selic,
        cdi=m.cdi,
        ipca=m.ipca,
        usd_brl=m.usd_brl,
        is_stale=m.is_stale,
        source_label=m.source_label,
    )
