// Narrow TMDB proxy for Reel Roulette, so visitors don't need their own API key.
// The key lives in the TMDB_API_KEY environment variable on Netlify and is never
// sent to the browser. Only the endpoints and query params the app uses are
// forwarded; everything else is rejected. Netlify rate-limits per visitor IP
// (see config below) and caches successful responses at its CDN.

const TMDB = "https://api.themoviedb.org/3";

const ALLOWED_ORIGINS = new Set(["https://grandpayri.github.io"]);
const isLocalOrigin = o => /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(o);

// Each route: path pattern, allowed query params, CDN cache lifetime in seconds.
const DISCOVER_PARAMS = [
  "watch_region", "sort_by", "vote_count.gte", "with_watch_providers", "with_watch_monetization_types",
  "with_genres", "primary_release_date.gte", "primary_release_date.lte",
  "first_air_date.gte", "first_air_date.lte", "with_runtime.lte", "with_cast", "page",
];
const ROUTES = [
  { re: /^\/genre\/(movie|tv)\/list$/,                 params: [],                     ttl: 86400 },
  { re: /^\/watch\/providers\/(movie|tv)$/,            params: ["watch_region"],       ttl: 86400 },
  { re: /^\/discover\/(movie|tv)$/,                    params: DISCOVER_PARAMS,        ttl: 3600 },
  { re: /^\/search\/person$/,                          params: ["query"],              ttl: 86400 },
  { re: /^\/(movie|tv)\/\d{1,10}$/,                    params: ["append_to_response"], ttl: 86400 },
  { re: /^\/(movie|tv)\/\d{1,10}\/watch\/providers$/,  params: [],                     ttl: 21600 },
];
const MAX_PARAM_LENGTH = 200;

function json(status, body, headers) {
  return new Response(JSON.stringify(body), { status, headers: { ...headers, "Content-Type": "application/json" } });
}

export default async (req) => {
  const origin = req.headers.get("origin");
  // Browsers always send Origin on cross-origin requests; requests without one
  // (same-origin or non-browser) are allowed and left to the rate limit.
  if (origin && !ALLOWED_ORIGINS.has(origin) && !isLocalOrigin(origin)) {
    return json(403, { error: "Origin not allowed" }, {});
  }
  const cors = {
    "Access-Control-Allow-Origin": origin || "*",
    "Vary": "Origin",
    "Netlify-Vary": "header=Origin",
  };
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: { ...cors, "Access-Control-Allow-Methods": "GET", "Access-Control-Max-Age": "86400" } });
  }
  if (req.method !== "GET") return json(405, { error: "Only GET is supported" }, cors);

  const url = new URL(req.url);
  const path = url.pathname.replace(/^\/api\/tmdb/, "");
  const route = ROUTES.find(r => r.re.test(path));
  if (!route) return json(404, { error: "Not available through this proxy" }, cors);

  const upstream = new URL(TMDB + path);
  for (const [k, v] of url.searchParams) {
    if (!route.params.includes(k) || v.length > MAX_PARAM_LENGTH) {
      return json(400, { error: "Unsupported parameter: " + k }, cors);
    }
    if (k === "append_to_response" && v !== "credits") {
      return json(400, { error: "Unsupported append_to_response" }, cors);
    }
    upstream.searchParams.set(k, v);
  }

  const key = Netlify.env.get("TMDB_API_KEY");
  if (!key) return json(500, { error: "Proxy is not configured" }, cors);
  upstream.searchParams.set("api_key", key);

  let res;
  try {
    res = await fetch(upstream);
  } catch {
    return json(502, { error: "TMDB is unreachable" }, cors);
  }
  // A 401 means the proxy's own key is bad; don't tell the visitor their key was rejected.
  if (res.status === 401) return json(502, { error: "The shared TMDB key was rejected" }, cors);

  const headers = { ...cors, "Content-Type": "application/json" };
  if (res.ok) {
    headers["Cache-Control"] = "public, max-age=300";
    headers["Netlify-CDN-Cache-Control"] = `public, durable, s-maxage=${route.ttl}, stale-while-revalidate=${route.ttl}`;
  }
  return new Response(await res.text(), { status: res.status, headers });
};

export const config = {
  path: "/api/tmdb/*",
  // Per visitor IP. A spin is ~4-7 requests and each filter change ~1-2.
  rateLimit: { windowLimit: 60, windowSize: 60, aggregateBy: ["ip", "domain"] },
};
