# investa

Análise patrimonial — Imóvel vs Carteira diversificada (v2).

Migração do dashboard `dashboard-investimentos` (Streamlit) para uma stack web moderna.

## Estrutura

- `api/` — Backend FastAPI com a engine de simulação
- `web/` — Frontend Next.js 14 (App Router, Tailwind v4, shadcn/ui)
- `docs/design-handoff/` — Mock e tokens de design
- `.github/workflows/` — CI

## URLs de produção

- **API:** https://investa-api-igh9.onrender.com (Render free tier, cold start ~30s após inatividade)
- **Web:** https://investa-beta.vercel.app

## Status das fases

- ✅ **Fase 1** — API FastAPI (engine, BCB SGS, Monte Carlo)
- ✅ **Fase 2** — Web shell (sidebar, topbar, 8 rotas placeholder)
- ✅ **Fase 3** — Visão Geral (KPIs, charts, drawer, scenario store)
- ⏳ **Fase 4** — Abas individuais
  - ✅ Renda Fixa (KPIs, tabela, IR regressivo, calendário, CSV import/export)
  - ✅ Imóvel (KPIs, custos, financiamento opcional SAC/Price, evolução, riscos)
  - ⬜ Carteira
  - ⬜ Sensibilidade
  - ⬜ Risco MC
  - ⬜ Tributação
  - ⬜ Exportar

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
