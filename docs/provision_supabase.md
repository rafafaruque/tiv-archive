# Provisioning Supabase (free tier) for TIV-archive

Steps:

1. Create a Supabase account at https://app.supabase.com/
2. Create a new project (choose free tier). Note the `DB connection string` in Project Settings → Database.
3. Enable PostGIS (Supabase DBs usually have PostGIS enabled by default). If not, run the SQL in `db/migrations/init.sql` via SQL editor.
4. Copy the `DB connection string` into your local `.env.local` as `DATABASE_URL`.
5. Run the ingestion script locally (or from a small cloud runner) with:

```bash
# ensure SPC CSV is at ./data/spc_tornadoes.csv or set SPC_CSV_PATH
export DATABASE_URL="your_connection_string"
export SPC_CSV_PATH=./data/spc_tornadoes.csv
npm run ingest:spc
```

Notes:
- Supabase automatically exposes REST and realtime endpoints; you can keep the DB private and use your Next.js server-side code to query it via `DATABASE_URL`.
- Neon is an alternative; steps are similar.
