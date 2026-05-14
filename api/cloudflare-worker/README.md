# investa-macro-proxy

Cloudflare Worker that caches `GET /api/macro` on the edge to absorb traffic that would otherwise hit Render's free tier (which has 30-90s cold starts after idle).

- **Scope:** only proxies `GET /api/macro`. Other paths return 404 — the frontend keeps hitting Render directly for them.
- **TTL:** 1h, matching the backend `cachetools.TTLCache` TTL on `/api/macro`.
- **CORS:** mirrors the FastAPI allow-list (production hosts + Vercel preview deploys).
- **Cost:** $0. Workers free tier is 100k requests/day; this endpoint sees a few requests per pageload.

## One-time setup

1. **Create a Cloudflare account** at <https://dash.cloudflare.com/sign-up>. Free.
2. **Install wrangler** in this directory:
   ```bash
   cd api/cloudflare-worker
   npm install
   ```
3. **Authenticate** wrangler with your account:
   ```bash
   npx wrangler login
   ```
   Opens a browser tab; click "Allow" and return.

## Deploy

```bash
cd api/cloudflare-worker
npm run deploy
```

Wrangler prints the public URL on success, e.g.:

```
Published investa-macro-proxy
  https://investa-macro-proxy.<your-handle>.workers.dev
```

Copy that URL.

## Wire up the frontend

In the Vercel dashboard for the `investa` project, add an environment variable:

```
NEXT_PUBLIC_MACRO_URL = https://investa-macro-proxy.<your-handle>.workers.dev/api/macro
```

Apply to **Production**, **Preview**, and **Development** environments. Then trigger a redeploy (push any commit, or use "Redeploy" in the Vercel UI).

## Verify

```bash
# First request - MISS (cold from Render)
curl -i https://investa-macro-proxy.<your-handle>.workers.dev/api/macro | grep -E '^(HTTP|X-Worker-Cache|Cache-Control)'

# Repeat within an hour - HIT (instant)
curl -i https://investa-macro-proxy.<your-handle>.workers.dev/api/macro | grep X-Worker-Cache
```

Expected: `X-Worker-Cache: MISS` on first call, `HIT` on subsequent calls within the TTL.

## Rollback

To stop using the Worker without redeploying it:

1. Delete `NEXT_PUBLIC_MACRO_URL` from Vercel env vars.
2. Trigger a redeploy.

The frontend falls back to hitting Render directly. The Worker keeps running (free) but is unused; you can also delete it with `npx wrangler delete`.

## Local dev

```bash
npm run dev
```

Wrangler serves at `http://localhost:8787`. Hit `http://localhost:8787/api/macro` to test.

## Observability

```bash
npm run tail
```

Streams live Worker logs. Useful when debugging cache behavior or CORS issues.
