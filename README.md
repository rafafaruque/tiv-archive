# TIV Archive

An interactive archive of historical U.S. tornadoes, built with Next.js, MapLibre, and NOAA/SPC data.

Explore tornado paths, replay historical storms, travel through decades of tornado history, and discover related reports using the Parallel Search API.

## Explore TIV Archive

**[Launch TIV Archive ↗](https://tiv-archive-iszt.vercel.app/)**

The app is free to explore in your browser. 

## Historical Source Discovery — Powered by Parallel

TIV Archive uses the [Parallel Search API](https://parallel.ai) to connect tornado records with relevant historical sources.

Select any tornado and click **Explore this storm** to discover related weather-service reports, news articles, and historical documentation.

The integration includes context-aware search, relevance classification, readable source previews, and caching to reduce unnecessary API calls.

Results are potential historical sources, not guaranteed matches to individual tornadoes.

[Read more about the implementation](docs/storm-sources.md).

---

## For Developers: Run Locally (Optional)

The following instructions are **only for developers who want to run their own copy**. You do not need to follow them to use the live website.

### 1. Clone and install

```bash
git clone https://github.com/rafafaruque/tiv-archive.git
cd tiv-archive
npm install
```

### 2. Start the development server

```bash
npm run dev
```

Visit [http://localhost:3000](http://localhost:3000).

Local development uses the hosted tornado dataset automatically, so no database setup is required.

### 3. Enable Parallel Search locally (Optional)

To use **Explore this storm** on your local copy, create a `.env.local` file and add your own [Parallel API key](https://platform.parallel.ai):

```env
PARALLEL_API_KEY=your_api_key_here
```

Restart the development server after adding the key.

**Note:** The live website already has Parallel configured. You only need your own key when running the project locally.

For independent database hosting and advanced search configuration, see the [database setup guide](docs/provision_supabase.md).

## Stack

Next.js · TypeScript · MapLibre · PostgreSQL/PostGIS · NOAA/SPC · Parallel Search API

