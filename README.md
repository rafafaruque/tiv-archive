# 🌪️ TIV Archive

An interactive archive of historical U.S. tornadoes, built with Next.js, MapLibre, and NOAA Storm Prediction Center data.

Search locations across the U.S., explore historical tornado paths, replay storms, and travel through decades of tornado history. Discover related news articles and historical reports using the Parallel Search API.

**[Explore TIV Archive ↗](https://tiv-archive-iszt.vercel.app/)**

## Getting Started

**1. Clone the repository**

```bash
git clone https://github.com/rafafaruque/tiv-archive.git
cd tiv-archive
npm install
```

**2. Run locally**

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

No database setup is required for local development. The app uses the hosted tornado dataset by default.

## Parallel API (optional but recommended!)

To enable **Explore this storm**, which finds historical sources related to a selected tornado:

1. Get an API key from [Parallel](https://platform.parallel.ai).
2. Create a `.env.local` file in the project root.
3. Add your key:

```env
PARALLEL_API_KEY=your_api_key_here
```

Restart the development server.

The rest of TIV Archive works without a Parallel API key.

## Tech Stack

- **Frontend:** Next.js, React, TypeScript, MapLibre
- **Data:** NOAA/SPC, PostgreSQL/PostGIS
- **Research:** Parallel Search API

## Data & Documentation

Tornado data comes from the [NOAA Storm Prediction Center](https://www.spc.noaa.gov/wcm/#data).

Local development uses the hosted dataset. Running a separate database or enabling advanced natural-language search requires additional setup.

- [Database setup](docs/provision_supabase.md)
- [Parallel Search implementation](docs/storm-sources.md)

Historical search results are potential sources, not verified matches to individual tornadoes.

