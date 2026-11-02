https://tiv-archive-iszt.vercel.app/

## Explore this storm

Select a tornado, then click **Explore this storm** in its detail panel to find up to five potential historical sources. Cards display the titles, domains, and excerpts returned by Parallel Search and link to the original pages. These are search matches, **not verified matches**: outbreak reports may describe other tornadoes with the same date and state. No narrative is generated.

Add your key to the Git-ignored `.env.local` file (created locally for this feature), or copy `.env.example` to `.env.local` on a fresh checkout:

```dotenv
PARALLEL_API_KEY=your_parallel_api_key
```

Keep your existing `DATABASE_URL` and `SPC_CSV_PATH` configuration. Restart `npm run dev` after changing environment variables. On your host, set `PARALLEL_API_KEY` as a server environment variable. Never use a `NEXT_PUBLIC_` prefix.

`GET /api/storm-sources?id=<database-id>` resolves the existing canonical tornado record and its source metadata server-side. It searches using the confirmed date, available state/city/county, rating, source identifier, and path endpoints. If state metadata is unavailable, the search explicitly uses coordinates without guessing a location; records without a confirmed date or usable geometry return an explanatory error without calling Parallel. No NOAA data is modified.

The integration uses only `POST https://api.parallel.ai/v1/search`, with `mode: "fast"`, `advanced_settings.max_results: 5`, and excerpts limited to 700 characters per result. It uses native `fetch` and needs no additional dependencies. The request and result schemas follow Parallel's [best practices](https://docs.parallel.ai/search/best-practices), [API reference](https://docs.parallel.ai/api-reference/search/search), and [advanced settings](https://docs.parallel.ai/search/advanced-search-settings).

Search runs only after an explicit click. Successful results are cached by tornado ID for 24 hours in a bounded server-process cache and in memory for the browser session. Empty results expire after 15 minutes; errors are not cached. Concurrent requests for the same ID share a pending lookup. Server caches reset on restart and are separate across serverless instances, so a cold instance may repeat a search.

To test: run `npm run dev` with your normal database configuration, search a location, select a tornado, and click **Explore this storm**. Check the loading state, source links, mobile layout, and path replay. Close/reopen sources or select the same tornado again: the browser should reuse cached results. Without a key, the panel shows a configuration error and a retry button. After adding a key, retry; failures do not poison the cache.

Validation commands: `npx tsc --noEmit`, `npm run build`, and `node tests/stormSources.cjs`. The focused test uses mocked database/Search responses, so it does not spend API credits.
