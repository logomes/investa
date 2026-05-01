# investa

Análise patrimonial — Imóvel vs Carteira diversificada (v2).

Migração do dashboard `dashboard-investimentos` (Streamlit) para uma stack web moderna.

## Estrutura

- `api/` — Backend FastAPI com a engine de simulação
- `web/` — Frontend Next.js 14 (App Router) — _populado a partir da Fase 2_
- `docs/design-handoff/` — Mock e tokens de design
- `.github/workflows/` — CI

## URLs de produção

- **API:** https://investa-api.onrender.com (deploy: Render)
- **Web:** https://investa.vercel.app (deploy: Vercel — após Fase 2)

## Desenvolvimento local

Backend (a partir desta fase):
```bash
cd api
python3.12 -m venv .venv
.venv/bin/pip install -r requirements.txt -r requirements-dev.txt
.venv/bin/uvicorn main:app --reload --port 8000
```

Health check:
```bash
curl http://localhost:8000/api/health
```

## Testes

```bash
cd api
.venv/bin/pytest -v
```
