"""Health check endpoint."""
from fastapi import APIRouter

router = APIRouter()


@router.get("/api/health")
def health() -> dict[str, str]:
    """Liveness check used by Render and external monitors."""
    return {"status": "ok", "version": "1.0.0"}
