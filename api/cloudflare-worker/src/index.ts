/**
 * investa-macro-proxy — Cloudflare Worker that caches GET /api/macro on the
 * edge, absorbing traffic that would otherwise hit Render's free tier (cold
 * starts ~30-90s after idle).
 *
 * Scope: only proxies GET /api/macro. Every other path returns 404 — the
 * frontend continues hitting Render directly for those. Keeping the surface
 * narrow means the Worker can stay stateless and trivially auditable.
 *
 * Cache: 1h TTL matches the backend's cachetools.TTLCache TTL on /api/macro
 * (see api/core/services/macro.py). Edge cache + server cache stack — first
 * request after edge-miss bears the Render cold start; subsequent hits are
 * O(ms) from a CF colo.
 *
 * CORS: the response is consumed by https://investa-beta.vercel.app and
 * Vercel preview deploys (investa-*-logomes-projects.vercel.app). The Worker
 * mirrors the same allow-list the FastAPI CORS middleware uses (see
 * api/main.py ALLOWED_ORIGINS and ALLOWED_ORIGIN_REGEX).
 */

const RENDER_BASE = "https://investa-api-igh9.onrender.com";
const CACHE_TTL_SECONDS = 3600;

const STATIC_ORIGINS = new Set<string>([
  "https://investa.vercel.app",
  "https://investa-beta.vercel.app",
  "http://localhost:3000",
]);
const PREVIEW_ORIGIN_RE = /^https:\/\/investa(-[a-z0-9-]+)?-logomes-projects\.vercel\.app$/;

function isAllowedOrigin(origin: string | null): boolean {
  if (!origin) return false;
  return STATIC_ORIGINS.has(origin) || PREVIEW_ORIGIN_RE.test(origin);
}

function corsHeaders(origin: string | null): Record<string, string> {
  const allowed = isAllowedOrigin(origin);
  return {
    "Access-Control-Allow-Origin": allowed ? origin! : "https://investa-beta.vercel.app",
    "Vary": "Origin",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };
}

export default {
  async fetch(request: Request, _env: unknown, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    const origin = request.headers.get("Origin");

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders(origin) });
    }

    if (request.method !== "GET" || url.pathname !== "/api/macro") {
      return new Response("Not Found", { status: 404, headers: corsHeaders(origin) });
    }

    const cache = caches.default;
    // Build a cache key without the Origin header so different browsers share the same edge entry.
    const cacheKey = new Request(`${url.origin}/api/macro`, { method: "GET" });

    let response = await cache.match(cacheKey);
    if (!response) {
      const upstream = await fetch(`${RENDER_BASE}/api/macro`, {
        method: "GET",
        headers: { "Accept": "application/json" },
      });

      // Only cache successful 2xx — never poison the edge with a 502/504 from Render cold start.
      if (upstream.ok) {
        response = new Response(upstream.body, upstream);
        response.headers.set("Cache-Control", `public, max-age=${CACHE_TTL_SECONDS}`);
        response.headers.set("X-Worker-Cache", "MISS");
        ctx.waitUntil(cache.put(cacheKey, response.clone()));
      } else {
        // Pass the upstream error through without caching.
        response = new Response(upstream.body, upstream);
        response.headers.set("X-Worker-Cache", "BYPASS");
      }
    } else {
      response = new Response(response.body, response);
      response.headers.set("X-Worker-Cache", "HIT");
    }

    // Apply CORS to the final response. Cache stores the upstream body but each
    // request gets per-origin CORS — this preserves the per-origin allow-list
    // even though the cache entry is origin-agnostic.
    const cors = corsHeaders(origin);
    for (const [k, v] of Object.entries(cors)) response.headers.set(k, v);

    return response;
  },
};
