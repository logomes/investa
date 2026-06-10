"""GET /api/portfolio/defaults — default scenario for first form load."""
from dataclasses import asdict

from fastapi import APIRouter

from core.config import (
    BenchmarkParams,
    PortfolioParams,
    RealEstateParams,
)

router = APIRouter()


def _camel_dict(d: dict) -> dict:
    """Convert a snake_case dict to camelCase recursively."""
    if not isinstance(d, dict):
        return d
    out = {}
    for k, v in d.items():
        parts = k.split("_")
        camel_key = parts[0] + "".join(p.title() for p in parts[1:])
        if isinstance(v, dict):
            out[camel_key] = _camel_dict(v)
        elif isinstance(v, list):
            out[camel_key] = [_camel_dict(x) if isinstance(x, dict) else x for x in v]
        else:
            out[camel_key] = v
    return out


@router.get("/api/portfolio/defaults")
def defaults() -> dict:
    """Return the default scenario (RealEstate + Portfolio + Benchmark) for first load."""
    re_defaults = asdict(RealEstateParams())
    pf_defaults = asdict(PortfolioParams())
    bench = BenchmarkParams()
    # Return in BenchmarkInput schema shape (selic_rate shim until T4 reworks the schema)
    bench_defaults = {"selic_rate": bench.annual_rate, "tax_rate": bench.tax_rate}
    return {
        "realEstate": _camel_dict(re_defaults),
        "portfolio": _camel_dict(pf_defaults),
        "benchmark": _camel_dict(bench_defaults),
    }
