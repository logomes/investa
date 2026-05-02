"""FastAPI application entry point."""
from fastapi import FastAPI

from routers import fixed_income, health, macro, portfolio, simulation

app = FastAPI(
    title="investa API",
    description="Análise patrimonial — Imóvel vs Carteira",
    version="1.0.0",
)

app.include_router(health.router)
app.include_router(macro.router)
app.include_router(portfolio.router)
app.include_router(simulation.router)
app.include_router(fixed_income.router)
