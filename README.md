https://tiv-archive-iszt.vercel.app/

## Explore this storm

Select a tornado, then click **Explore this storm** in its detail panel to find up to five potential historical sources. Cards display the titles, domains, and excerpts returned by Parallel Search and link to the original pages. These are search matches, **not verified matches**: outbreak reports may describe other tornadoes with the same date and state. No narrative is generated.

Add your key to the Git-ignored `.env.local` file (created locally for this feature), or copy `.env.example` to `.env.local` on a fresh checkout:

```dotenv
PARALLEL_API_KEY=your_parallel_api_key
```

Keep your existing `DATABASE_URL` and `SPC_CSV_PATH` configuration. Restart `npm run dev` after changing environment variables. On your host, set `PARALLEL_API_KEY` as a server environment variable. Never use a `NEXT_PUBLIC_` prefix.

`GET /api/storm-sources?id=<database-id>` resolves the existing canonical tornado record and its source metadata server-side. It searches using the confirmed date, available state/city/county, rating, source identifier, and path endpoints. If state metadata is unavailable, the search explicitly uses coordinates without guessing a location; records without a confirmed date or usable geometry return an explanatory error without calling Parallel. No NOAA data is modified.

The integration uses only `POST https://api.parallel.ai/v1/search`, with `mode: "fast"`, `advanced_settings.max_results: 5`, and an excerpt budget of 1,200 characters per result so useful prose has room beyond site navigation. It uses native `fetch` and needs no additional dependencies. The request and result schemas follow Parallel's [best practices](https://docs.parallel.ai/search/best-practices), [API reference](https://docs.parallel.ai/api-reference/search/search), and [advanced settings](https://docs.parallel.ai/search/advanced-search-settings).

Search runs only after an explicit click. Successful results are cached by tornado ID for 24 hours in a bounded server-process cache and in memory for the browser session. Empty results expire after 15 minutes; errors are not cached. Concurrent requests for the same ID share a pending lookup. Server caches reset on restart and are separate across serverless instances, so a cold instance may repeat a search.

To test: run `npm run dev` with your normal database configuration, search a location, select a tornado, and click **Explore this storm**. Check the loading state, source links, mobile layout, and path replay. Close/reopen sources or select the same tornado again: the browser should reuse cached results. Without a key, the panel shows a configuration error and a retry button. After adding a key, retry; failures do not poison the cache.

Validation commands: `npx tsc --noEmit`, `npm run build`, `node tests/stormSources.cjs`, and `node tests/stormSourcePresentation.cjs`. The focused tests use fixtures and mocked database/Search responses, so they do not spend API credits.

### Source presentation and relevance limitations

Excerpts are selected deterministically from the returned text, with markdown/HTML formatting, obvious menus, pipe tables, and repeated text removed. Up to two storm-related sentences are selected, capped at 420 characters and displayed in four lines inside a bounded, independently scrollable source list. Ellipses indicate omitted text; previews containing only boilerplate are omitted. Facts are not paraphrased or generated, and the original page remains available through its title link. On shorter desktop screens, the existing **Details** toggle also makes metadata available on demand while researching, keeping the date and replay controls within reach.

**Likely event match** requires an explicit matching event date, state, and city in the same title or sentence. County-only matches additionally require the recorded F/EF intensity. Conflicting dates in the title, conflicting ratings in the passage, or explicit outbreak/multiple-tornado language prevent this label. Likely matches are shown first, preserving provider order within each group. Publication dates, database/source identifiers, and date/state overlap alone do not establish event identity.

**Broader outbreak coverage** is the conservative fallback for sources that cannot be tied to the selected track, including results with insufficient text. This label does not verify that a page covers the selected tornado or even its outbreak. Valid sources remain accessible instead of being aggressively filtered out.

For the project report: these labels are text-based heuristics, not historical verification. A city or county can still contain multiple tornadoes on one date; a report can compare events or omit identifying details. The current archive enrichment normally supplies state and coordinates, not city/county names, so many legitimate sources will retain the broader label. Coordinates guide Search but are not reverse-geocoded or used to assert exact matches. Cleanup may miss unusual boilerplate or omit useful table-only material; consult the original source for context. No full-page extraction or additional AI model is used. Existing cache TTLs still apply; restart/redeploy and reload the page to discard earlier in-memory results after an update.
