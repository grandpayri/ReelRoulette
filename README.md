# 🎬 Reel Roulette

**Can't decide what to watch? Spin the wheel.**

**▶ [grandpayri.github.io/ReelRoulette](https://grandpayri.github.io/ReelRoulette/)**

Reel Roulette picks a random movie or TV show that's streaming right now on the services you actually have. Choose your subscriptions, add a filter or two if you like, and spin. It works on phones and computers, and there's nothing to install and no account to create.

## How to use it

1. **Choose 🎬 Movie or 📺 Binge a show** at the top.
2. **Tap the services you subscribe to** (Netflix, Prime Video, Disney+, Max, Hulu, and so on). Tubi and Pluto TV are free.
3. **Optionally open "Optional filters"** to narrow things down by:
   - genre or decade
   - an actor (movies only)
   - max runtime or episode length
   - free titles only, or only titles included with Prime at no extra cost
4. **Hit Spin the wheel.**

When the wheel stops, you'll see the pick with its genres, cast and summary.

- **Tap a service badge** (like *Netflix ↗*) to find the title on that service.
- **Tap the poster** to see the title on TMDB.
- **Not feeling it** spins again and skips that pick for this session.
- **👁 Seen it** remembers that you've seen it and spins again. You won't be offered that title again.
- **We're watching this** also marks it as seen, so it won't come up next time.
- **← Spin again** takes you back to your services and filters.

If you mark something as seen by accident, tap **Undo**. To see seen titles again or clear the list, go to **Optional filters → Already seen**.

### Your data stays on your device

Your chosen services, filters, mode and seen list are saved in **your own browser only**. There's no account and no server-side storage. Clearing your browser data resets the app, and a different phone or browser starts fresh.

### Settings

The **Settings** link at the bottom of the page lets you:
- **Change your region:** US, UK, Canada, Australia, Germany or France.
- **Use your own TMDB API key (optional):** you don't need one. It's a backup for when the shared connection is busy. The Settings page explains how to get a free key.

If you spin a lot very quickly, you may see a "wait a minute" message. That's the shared connection's abuse protection, and it clears within a minute.

## How it works

```
Your browser ──► GitHub Pages (index.html, the whole app)
     │
     └──► Netlify Function (/api/tmdb/*) ──► TMDB API
          adds the API key, allows only the app's requests,
          rate-limits each visitor, caches responses
```

- **The app** is a single self-contained page, [`index.html`](index.html), in vanilla HTML/CSS/JS with no build step and no dependencies. It's hosted on GitHub Pages.
- **The proxy**, [`netlify/functions/tmdb.mjs`](netlify/functions/tmdb.mjs), is a small Netlify Function that lets visitors use TMDB without their own API key.
  - The key is stored as a Netlify environment variable. It's never in this repo and never sent to the browser.
  - It only forwards the handful of TMDB endpoints and parameters the app uses, and it only accepts browser requests from the app's own site.
  - Netlify rate-limits it to 60 requests per minute per visitor, and caches successful responses.
- **Service links:** TMDB's API doesn't provide direct links to a title on each streaming service, so the badges open that service's own search for the title. Services without a known search page link to TMDB's "where to watch" page instead.

## Running your own copy

1. **Fork this repo** and turn on GitHub Pages (**Settings → Pages → Deploy from branch → `main` / root**).
2. **Get a free TMDB API key** at [themoviedb.org/settings/api](https://www.themoviedb.org/settings/api).
3. **Set up the proxy on Netlify** (you can sign in with GitHub):
   - **Add new project → Import an existing project**, and pick your fork. The build settings come from [`netlify.toml`](netlify.toml).
   - **Project configuration → Environment variables:** add `TMDB_API_KEY` with your key, marked as a secret.
   - **Project configuration → General → Visitor access:** make sure the project is **Public**. Otherwise every request is redirected to a Netlify login.
   - Trigger a redeploy so the variable takes effect.
4. **Point the app and proxy at each other:**
   - In `index.html`, set `RELAY_URL` to `https://<your-project>.netlify.app/api/tmdb`.
   - In `netlify/functions/tmdb.mjs`, set `ALLOWED_ORIGINS` to your GitHub Pages origin, for example `https://<you>.github.io`.

If you leave `RELAY_URL` empty, the app skips the proxy and asks each visitor for their own TMDB key. After setup, pushing to `main` deploys both GitHub Pages and Netlify.

### Local development

Serve the folder over HTTP, then open `http://localhost:8000`:

```bash
python -m http.server 8000
```

Any static server works, but opening the file directly (`file://`) won't save settings. The proxy accepts requests from `localhost`, so a local copy uses the shared connection too. If the app starts using a new TMDB endpoint or query parameter, add it to `ROUTES` in `netlify/functions/tmdb.mjs`, or the proxy will reject it.

## Credits

- **Movie and TV data:** [TMDB](https://www.themoviedb.org/). *This product uses the TMDB API but is not endorsed or certified by TMDB.*
- **Streaming availability data:** [JustWatch](https://www.justwatch.com/), via TMDB.

Reel Roulette is a personal, non-commercial project.
