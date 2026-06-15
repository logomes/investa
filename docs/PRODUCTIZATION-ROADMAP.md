# investa — Productization Roadmap (SaaS / assinaturas)

**Status:** Backlog estratégico (não iniciado). Registrado 2026-06-15 a pedido do owner.
**Goal:** profissionalizar o investa de "ferramenta pessoal" para produto pago com assinatura recorrente (BR + US).

Esta track é **ortogonal** às rodadas de feature (① ponte+solver, ② reais de hoje,
③ tributação forward, ④ copiloto IA) — são fundações de produto, não features de análise.
Cada item vira seu próprio ciclo spec → plano → implementação quando priorizado.

## Estado atual (o gap a fechar)

investa hoje é **100% client-side single-user**: todos os dados (carteira, renda fixa,
snapshots, cenário) vivem em `localStorage` (stores Zustand); a API FastAPI é **stateless**
(só calcula projeções, não persiste nada, não tem usuários nem auth). Cotações vêm de uma
cadeia gratuita sem chave (brapi → Yahoo `.SA` BR; Yahoo → Stooq US) via `/api/quotes`;
macro do BCB com cache no Cloudflare Worker. Não há banco de dados, login, nem cobrança.

Vender assinatura exige introduzir backend com estado, identidade e confiabilidade — daí
estes três itens. O **multi-tenancy é a fundação**: os outros dois dependem dele.

---

## 1. Multi-tenancy / isolamento de dados — FUNDAÇÃO

**Razão (owner):** "Se hoje o investa assume um único usuário, modele tenant isolado agora,
enquanto é pequeno. Depois é refactor caro."

- Introduzir persistência server-side (Postgres) com isolamento por tenant desde o dia 1 —
  cada query carrega o `tenant_id`; nunca um `SELECT` sem escopo de tenant.
- Migrar os stores localStorage (ativos, renda-fixa, snapshots de patrimônio, cenário,
  goalTarget) para tabelas por-usuário. localStorage vira cache/otimista, não a fonte da verdade.
- Decidir o modelo de isolamento: row-level (um schema, `tenant_id` + RLS no Postgres) é o
  pragmático pra começar; schema-per-tenant só se exigência de compliance aparecer.
- **Por que agora:** retrofitar isolamento depois que a base de código assume "um usuário"
  toca toda leitura/escrita — o custo cresce com cada feature nova (rodadas 1-4 já assumem
  single-user no localStorage).
- **Dependência:** nada. É o pré-requisito de 2 e 3 (auth precisa de onde guardar usuário;
  pipeline pago precisa de cache persistente por-tenant).

## 2. Auth + billing como seam separado

**Razão (owner):** "Stripe (recorrência US/BR) plugado no core, não espalhado pela app."

- **Auth** como camada isolada (provider — Clerk/Auth0/Supabase Auth ou NextAuth) que emite
  identidade; o resto da app consome `tenant_id` via um único ponto, não re-implementa auth.
- **Billing** atrás de uma interface fina (`subscription.isActive(tenant)`, `plan(tenant)`)
  — Stripe é o backend, mas a app **nunca** chama Stripe direto espalhado pelos componentes.
  Webhooks do Stripe → estado de assinatura no Postgres → a app só lê o estado local.
- Recorrência **BR + US**: Stripe cobre ambos (cartão BR, Pix via Stripe, USD). Modelar
  planos (free / pago) e o gate de feature num único lugar.
- **Dependência:** multi-tenancy (item 1) — billing precisa de usuário/tenant para anexar.

## 3. Pipeline de dados confiável

**Razão (owner):** "Pra produto pago você não pode depender de scraping frágil. brapi/StatusInvest
pra BR, yfinance/FMP pra US, com cache em Postgres e fallback. Cotação quebrada = reembolso."

- Substituir a cadeia gratuita best-effort atual por uma com **SLA**: fontes pagas/estáveis
  (brapi pago ou StatusInvest BR; FMP ou yfinance US) com **fallback em cascata** explícito.
- **Cache em Postgres** por ativo (last good price + timestamp); servir do cache quando a
  fonte primária falha, em vez de quebrar a tela.
- **Monitoramento**: alertar quando uma fonte cai; "cotação quebrada = reembolso" implica
  medir disponibilidade e ter política de crédito/reembolso por SLA não cumprido.
- **Dependência:** cache por-tenant ⇒ banco (item 1). Pode evoluir o `/api/quotes` atual
  incrementalmente enquanto o resto não existe, mas o cache persistente exige o Postgres.

---

## Sequência sugerida

1 (multi-tenancy/Postgres) → 2 (auth, depois billing sobre auth) → 3 (pipeline confiável
sobre o cache do Postgres). O item 3 pode começar em paralelo assim que o Postgres existir.

## Riscos / decisões em aberto

- **Pivô de arquitetura:** sai de "tudo no cliente" para backend com estado — é a mudança
  mais cara da history do projeto; fazer cedo (enquanto a base é pequena) é o ponto do owner.
- **Migração de dados dos usuários atuais** (hoje só o owner, em localStorage): um import
  one-shot localStorage → conta quando o login existir.
- **Custo de infra:** Postgres gerenciado + fontes de cotação pagas mudam o custo de ~R$0
  (free tiers) para recorrente — precifica isso na assinatura.
- **Deploy:** hoje Vercel (web) + Render free (api stateless). Banco gerenciado (Neon/Supabase
  no marketplace Vercel, ou Render Postgres) e Render pago entram aqui.
