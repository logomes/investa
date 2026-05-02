"""FastAPI application entry point."""
from fastapi import FastAPI

from routers import health

app = FastAPI(
    title="investa API",
    description="Análise patrimonial — Imóvel vs Carteira",
    version="1.0.0",
)

app.include_router(health.router)
