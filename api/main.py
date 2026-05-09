"""FastAPI application entry point."""
from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from routers import fixed_income, health, macro, portfolio, quotes, simulation


app = FastAPI(
    title="investa API",
    description="Análise patrimonial — Imóvel vs Carteira",
    version="1.0.0",
)


# ---------- CORS ----------

# Static origins (production and local dev)
ALLOWED_ORIGINS = [
    "https://investa.vercel.app",
    "https://investa-beta.vercel.app",
    "http://localhost:3000",
]

# Regex for Vercel preview deploys: investa-{anything}-logomes-projects.vercel.app
# and any sub-branch URL like investa-git-feat-xxx-logomes-projects.vercel.app
ALLOWED_ORIGIN_REGEX = r"https://investa(-[a-z0-9-]+)?-logomes-projects\.vercel\.app"

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_origin_regex=ALLOWED_ORIGIN_REGEX,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["*"],
    allow_credentials=False,
)


# ---------- Structured error handler ----------

@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    """Wrap Pydantic validation errors in our documented {error, message, details} shape."""
    first = exc.errors()[0] if exc.errors() else {}
    field = ".".join(str(p) for p in first.get("loc", []) if p != "body")
    return JSONResponse(
        status_code=422,
        content={
            "error": "validation_failed",
            "message": first.get("msg", "validation error"),
            "details": {"field": field, "errors": exc.errors()},
        },
    )


# ---------- Routers ----------

app.include_router(health.router)
app.include_router(macro.router)
app.include_router(portfolio.router)
app.include_router(simulation.router)
app.include_router(fixed_income.router)
app.include_router(quotes.router)
