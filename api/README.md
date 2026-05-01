# investa — API

FastAPI backend wrapping the simulation engine.

## Endpoints

- `GET /api/health`
- `GET /api/macro`
- `GET /api/portfolio/defaults`
- `POST /api/simulate`
- `POST /api/simulate/monte-carlo`
- `POST /api/fixed-income/simulate`

See [openapi.json](http://localhost:8000/openapi.json) when running locally for the full schema.

## Local dev

```bash
python3.12 -m venv .venv
.venv/bin/pip install -r requirements.txt -r requirements-dev.txt
.venv/bin/uvicorn main:app --reload --port 8000
```

## Tests

```bash
.venv/bin/pytest -v
```
