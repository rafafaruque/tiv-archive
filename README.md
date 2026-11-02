# TIV Archive

Explore historical U.S. tornado records, map their paths, and replay selected storms.

**Live project:** [tiv-archive-iszt.vercel.app](https://tiv-archive-iszt.vercel.app)

## Run locally

```bash
git clone https://github.com/rafafaruque/tiv-archive.git
cd tiv-archive
npm install
npm run dev
```

Open [localhost:3000](http://localhost:3000). No environment file, API key, database setup, or data import is required for location searches, date/rating filters, storm details, and path replay. Internet access is required.

With `npm run dev` and no `DATABASE_URL`, the local Next.js server reads historical data from the live project's public API. It proxies only validated GET requests for `/api/search` (including `datesOnly=true`) and `/api/tornado`, using a fixed host and no forwarded credentials or browser headers. The browser talks to the local server, avoiding cross-origin requests for tornado data. Hosted failures return a clear error; this mode depends on the live service being available.

A configured `DATABASE_URL` always uses your database. If you already have `.env.local`, you can try hosted mode without editing it:

```bash
DATABASE_URL= npm run dev
```

Hosted fallback is development-only. `npm run build` needs no database, but `npm start` and production deployments require `DATABASE_URL` to serve tornado data. Production never proxies back to itself.

## Optional features

- **Storm sources:** add your own server-only `PARALLEL_API_KEY` to `.env.local` and restart the dev server. Parallel Search runs locally only after clicking **Explore this storm**; it is never proxied through the deployed site's research endpoint. See [configuration and relevance limitations](docs/storm-sources.md).
- **Your own database:** set `DATABASE_URL` and `SPC_CSV_PATH` in `.env.local`, enable PostGIS, and import the bundled CSV into your own database. See the [database setup guide](docs/provision_supabase.md) and `.env.example`. Hosted mode never imports or writes records.
- **Natural-language/semantic search:** the existing `/api/nl-search` route requires your own database; semantic search also needs its existing embedding/OpenAI setup. It is not part of the hosted proxy. Use location search and map filters for the default contributor setup.

Keep all credentials in Git-ignored `.env.local` or server environment variables. Never prefix secret keys with `NEXT_PUBLIC_`.

## Checks

```bash
npm run build
npx tsc --noEmit
for test in tests/*.cjs; do node "$test" || exit 1; done
```

Run the build before the standalone type check so Next.js has generated its route types. Tests use fixtures and mocks, without changing a database or spending API credits.
