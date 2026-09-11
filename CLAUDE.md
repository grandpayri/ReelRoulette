# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

Reel Roulette is a random movie and TV show picker built on the TMDB v3 API. The user chooses Movie or Binge (TV) mode, their streaming services, and optional filters. The app then spins a poster "roulette" strip and lands on a title that is currently streaming on those services in their region.

The app is one self-contained file, `index.html`, with inline CSS and vanilla JS. It has no build step, package manager, dependencies, tests, or linter. There's also a small TMDB proxy, `netlify/functions/tmdb.mjs`, which lets visitors use the app without their own key.

## Running and deploying

- **The app** is hosted on GitHub Pages from the root of the `main` branch of `grandpayri/ReelRoulette`, at https://grandpayri.github.io/ReelRoulette/. Pushing to `main` deploys it.
- **The proxy** runs as a Netlify Function from the same repo, which Netlify deploys on push. `netlify.toml` publishes the repo as-is. The shared TMDB key is only in the Netlify environment variable `TMDB_API_KEY`, never in the repo.
- **Connecting the two:** `RELAY_URL` in `index.html` points the app at the proxy. When it's empty, the app requires a personal key, as before.
- **Local testing:** serve the folder over HTTP rather than opening `file://`. The Claude desktop Browser pane turns local files into `data:` URLs, and `localStorage` is disabled there.
- **Testing without an API key:**
  - For the app UI, replace the global `tmdb(path, params)` function with a mock in the browser console. Every API call goes through that function.
  - For the proxy, import the function in Node and call its default export with a `Request`, after stubbing `globalThis.Netlify = {env:{get}}` and `globalThis.fetch`.

## Proxy (`netlify/functions/tmdb.mjs`)

- **Allowlists:** it only forwards the endpoints and query params the app uses (`ROUTES`), and `append_to_response` is limited to `credits`. **If the app starts sending a new endpoint or param, add it to `ROUTES` too, or the proxy returns 400/404.**
- **Rate limiting:** Netlify rate-limits per visitor IP through `export const config.rateLimit`. Netlify's own 429 response has no CORS headers, so the browser sees it as a network error. `tmdb()` in the app words that error to match.
- **Origins:** browser requests are accepted only from `https://grandpayri.github.io` and localhost. Requests with no `Origin` header are allowed.
- **Caching:** successful responses are cached at Netlify's CDN (`Netlify-CDN-Cache-Control`, varied by Origin).
- **Hiding the key:** a TMDB 401 is returned as 502, so visitors are never told "your key was rejected".

## Architecture

**Persistence:** the `safeStorage*` wrappers use `window.storage` when it exists. That's the async key/value storage API Claude.ai artifacts provide (`get`/`set`/`delete`, each returning `{value}`). Otherwise, as on GitHub Pages, they fall back to `localStorage` with keys prefixed `reel-roulette:`, because the `*.github.io` origin is shared across the owner's repos. If neither works, `storageAvailable = false` and the app runs without persisting anything. Stored keys:
- `tmdb-key`, `tmdb-region`
- `selected-provider-ids` (JSON array)
- `media-type` (`movie`/`tv`)
- `seen-ids` (JSON array of `"movie:123"`/`"tv:456"`)

The API key must never be hard-coded into the file, since the repo is public.

**Key modes:** `tmdb()` calls TMDB directly with the visitor's own `apiKey` if one is saved. Otherwise it goes through `RELAY_URL` (`usingRelay()`). The Settings screen (`showSettings()`, from the footer link) holds the region and an optional personal key, which is required only when `RELAY_URL` is empty. A key is validated with a `/genre/movie/list` call before it's saved. Saving with a blank key deletes the stored one and returns to the proxy. It rejects v4 read access tokens (JWTs starting with `eyJ`).

**Startup flow:** `loadSavedSettings()` calls `initApp()` if there's a saved key or a proxy, and shows Settings otherwise. `initApp()` is safe to call again after settings change. On failure it shows `#loadErr` instead of replacing the DOM. `initApp()` fetches movie and TV genres, the region's watch providers (the movie list, whose provider IDs are shared with TV), the saved mode, and the seen list.

**Movie vs. Binge mode:** `mediaType` is `"movie"` or `"tv"`, which are TMDB's own media type names. It's interpolated straight into API paths (`/discover/{type}`, `/{type}/{id}`). Per-mode differences live in the `MEDIA` config: date field, runtime options and label, plural noun, and the lock-in message. Beyond that config:
- `applyMediaType()` rebuilds the genre dropdown (TV genres have different IDs and names) and the runtime dropdown when the mode changes.
- It hides the actor filter in TV mode, because `/discover/tv` doesn't support `with_cast`.
- TV results use `name`/`first_air_date` instead of `title`/`release_date`. `renderMovie()` handles both.

**Filters → `/discover/{type}`:** `buildDiscoverParams()` is the single place where UI state becomes TMDB discover params. Both the debounced (450 ms) live pool count in `updatePoolCount()` and the actual pick use it, so any new server-side filter belongs there. Non-obvious behaviors:
- "Included with Prime" overrides the selected platform chips and forces Prime + `flatrate`.
- "Free only" switches monetization from `flatrate` to `free,ads`.
- The actor filter resolves a name to a person ID through `/search/person`, cached in `personCache`. If nothing matches, it sends `with_cast=0` on purpose so the pool comes back empty.

**Picking:** `pickRandomMovieWithPool()` fetches page 1 plus one random page (capped at 500, TMDB's page limit). It merges them, dedupes, drops titles without posters, titles in `excludedIds`, and seen titles (`isHiddenSeen()`), then picks a random winner. Discover can't exclude IDs on the server, so if everything gets filtered out it tries up to 3 more random pages. The live pool count doesn't subtract seen titles.
- `excludedIds` holds session-only skips. The main spin button clears it, and "Not feeling it" adds the current title (`window.__lastMovie`) before spinning again.
- `seenKeys` is the persisted "Seen it" list. Keys are prefixed with the media type because movie and TV IDs overlap. Both "Seen it" and "We're watching this" add the current title through `markSeen()`, which shows an Undo note in `#seenNote`. "Seen it" also spins again through `respin()`. "Clear my seen list" uses a two-tap confirm instead of `confirm()`, which sandboxed artifact iframes can block.

**Views:** the "Spin the wheel" button hides `#pickerControls` (mode toggle, subscriptions, filters, button, pool count), leaving only the wheel and the result. The "← Spin again" link (`showPicker()`) brings the controls back. The link stays hidden while a spin is running, so the mode can't change mid-result.

**Roulette animation:** `buildStrip()` fills a strip with shuffled pool posters and places the winner at `TARGET_INDEX`. `spinToMovie()` then uses a CSS transform transition to translate the strip until that index sits under the center indicator. `POSTER_W` (96) must match the `.roulette-item` width, and `ITEM_W` adds the `.roulette-strip` gap (10px). If you change the CSS without updating them, the spin stops off-center. Strip posters are links to the title's TMDB page (`tmdbPageUrl()`).

**Result card:** `renderMovie()` fetches `/{type}/{id}?append_to_response=credits` and `/{type}/{id}/watch/providers`, and builds platform badges from the region's `flatrate`, `free`, and `ads` lists. The poster links to the TMDB page. TMDB's API has no per-service deep links (that data is licensed from JustWatch), so badges link to the service's own search for the title through `SERVICE_SEARCH`/`serviceSearchUrl()`. Services not listed there link to TMDB's "where to watch" page (the region's `link`). Only add search URL patterns you've verified.

The TMDB attribution line in the footer ("uses the TMDB API but is not endorsed or certified by TMDB") is a TMDB API terms requirement and should stay.
