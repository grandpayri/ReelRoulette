# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

Reel Roulette is a random movie picker built on the TMDB v3 API. The user picks their streaming services and optional filters. The app then spins a poster "roulette" strip and lands on a movie that is currently streaming on those services in their region.

The whole app is one self-contained file, `index.html`, with inline CSS and vanilla JS. It has no build step, package manager, dependencies, tests, or linter. It needs a TMDB v3 API key, which the user enters at runtime.

## Running and deploying

- It's hosted on GitHub Pages from the root of the `main` branch of `grandpayri/ReelRoulette`, at https://grandpayri.github.io/ReelRoulette/. Pushing to `main` deploys it.
- To test locally, serve the folder over HTTP rather than opening `file://`. The Claude desktop Browser pane turns local files into `data:` URLs, and `localStorage` is disabled there.

## Architecture

**Persistence:** the `safeStorage*` wrappers use `window.storage` when it exists. That's the async key/value storage API Claude.ai artifacts provide (`get`/`set`/`delete`, each returning `{value}`). Otherwise, as on GitHub Pages, they fall back to `localStorage` with keys prefixed `reel-roulette:`, because the `*.github.io` origin is shared across the owner's repos. If neither works, `storageAvailable = false` and the app runs without persisting anything. Stored keys: `tmdb-key`, `tmdb-region`, `selected-provider-ids` (JSON array). The API key must never be hard-coded into the file, since the repo is public.

**Startup flow:** `loadSavedSettings()` either shows `#setupSection` (to enter a key and region; the key is validated with a `/genre/movie/list` call before it's saved) or calls `initApp()`. `initApp()` fetches genres and the region's watch providers.

**Provider matching:** the chips come from `KNOWN_PLATFORMS`, not straight from TMDB. Each entry is matched by lowercase substring against TMDB `provider_name`, and the first TMDB provider that matches wins. That makes array order and how specific each `match` string is significant: `"max"` is a loose substring. `FREE_LABELS` marks ad-supported services, which get dashed chips.

**Filters → `/discover/movie`:** `buildDiscoverParams()` is the single place where UI state becomes TMDB discover params. Both the debounced (450 ms) live pool count in `updatePoolCount()` and the actual pick use it, so any new filter belongs there. Non-obvious behaviors:
- "Included with Prime" overrides the selected platform chips and forces Prime + `flatrate`.
- "Free only" switches monetization from `flatrate` to `free,ads`.
- The actor filter resolves a name to a person ID through `/search/person`, cached in `personCache`. If nothing matches, it sends `with_cast=0` on purpose so the pool comes back empty.

**Picking:** `pickRandomMovieWithPool()` fetches page 1 plus one random page (capped at 500, TMDB's page limit). It merges them, dedupes, drops movies without posters and movies in `excludedIds`, and picks a random winner. The main pick button clears `excludedIds`. "Not feeling it" adds the current movie (`window.__lastMovie`) to it before spinning again.

**Roulette animation:** `buildStrip()` fills a strip with shuffled pool posters and places the winner at `TARGET_INDEX`. `spinToMovie()` then uses a CSS transform transition to translate the strip until that index sits under the center indicator. `ITEM_W` (106) must equal `.roulette-item` width (96px) plus the `.roulette-strip` gap (10px). If you change the CSS without updating it, the spin stops off-center.

**Result card:** `renderMovie()` fetches `/movie/{id}?append_to_response=credits` and `/movie/{id}/watch/providers`, and builds platform badges from the region's `flatrate`, `free`, and `ads` lists.

The TMDB attribution line in the footer ("uses the TMDB API but is not endorsed or certified by TMDB") is a TMDB API terms requirement and should stay.
