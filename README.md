# TIV-archive — interactive tornado map (starter)

Scaffolded starter for the TIV-archive project: Next.js (App Router, TypeScript), a spatial Postgres ingestion script, and a simple search API route that uses PostGIS when `DATABASE_URL` is configured.

Quick commands

```bash
# install
npm install

# dev server
npm run dev

# ingest SPC CSV (set env vars first)
npm run ingest:spc
```

Notes
- Use Supabase or Neon for a hosted Postgres+PostGIS instance (both provide free tiers).
- The ingestion script expects the SPC CSV (columns for begin/end lat/lon). It creates LINESTRING geometries and inserts into a `tornadoes` table.

Demo mode (no OpenAI required)

1. Copy example env and enable mock parser:

	cp .env.example .env.local

2. Start the dev server in demo mode (this sets `PARSER_MOCK=true`):

	npm run dev:demo

3. Open http://localhost:3000 and try the NL input or search bar.

Admin

- View/clear cached NL parses at `/admin/parse-cache`.

To enable real OpenAI parsing, set `OPENAI_API_KEY` in `.env.local` and remove `PARSER_MOCK=true`.

### Event dates and history replay

SPC event dates are preserved in `tornadoes.event_date` and returned as ISO dates by
search, natural-language search, and detail endpoints. Existing databases need
`db/migrations/event_dates.sql`. To recover dates discarded by the original import:

```sh
node scripts/backfill_event_dates.js         # inspect matches; rolls back
node scripts/backfill_event_dates.js --apply # commit unambiguous matches only
```

The backfill uses the source CSV path (`SPC_CSV_PATH` or `data/spc_tornadoes.csv`)
and matches path geometry, magnitude, dimensions, casualties, and event identifier
when available. Ambiguous matches remain null; it never derives dates from IDs.
It does not deduplicate records or change the existing geometry/measurements.

The timeline spans the database's dated extent and displays cumulative history
through the selected year **within loaded search results** (the spatial endpoint
still caps results at 200). Undated records remain visible and are counted in the
timeline label. Density marks describe loaded results, not nationwide totals.

### Exploration controls and source metadata

EF filters, year-range/history filtering, and sorting compose on the loaded result
set. Unknown values sort last; ties use database ID. Nearest uses PostGIS distance
from the search point to the recorded path. Map markers remain a single GPU-rendered
MapLibre source/layer; only the replay sprite is a DOM marker.

Location searches can be shared through the URL: location coordinates, label,
radius, EF selections, sort, year range/history year, and selected ID are restored.
Search/filter/sort/selection changes create navigation entries; timeline updates
replace the current entry. Natural-language result sets without a resolved location
are not currently reproducible from a shared URL.

The server caches an index of `data/spc_tornadoes.csv` (or `SPC_CSV_PATH`) to enrich
matching records with **state**, not guessed city names. Deployments must include
that CSV. Matching checks coordinates, rating, dimensions, casualties, and available
event dates/identifiers. The legacy importer stored SPC miles in `path_length_km`;
verified matches are converted to kilometers in API responses. Unverified lengths
are omitted instead of claiming an unsupported unit. No database values are changed.
City names and county-code-to-name lookup still require additional geographic data.

Use bracket keys (`[` / `]`) on the focused map canvas to preview records, Enter to
select, and Escape to dismiss. Results expose the same information as keyboard
buttons. Native timeline arrow keys remain available.

Run `node tests/explorer.cjs` for deterministic naming, sort/filter, URL, and missing-
data regression checks, followed by `npx tsc --noEmit` and `npm run build`.

### Duplicate import reconciliation

Run `node scripts/reconcile_duplicates.js` for a read-only source audit, then add `--apply` to record canonical IDs and restore verified source dates and casualty values. This requires the original SPC CSV and database access. No rows are deleted: duplicate IDs resolve to their canonical record. Search filters aliases before applying result limits. Ambiguous source matches remain separate. Both SPC importers use full-source-row identities to skip reimporting already identified records; unresolved legacy records may still overlap source rows. Geometry and stored measurements are unchanged.
