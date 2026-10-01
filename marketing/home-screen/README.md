# Home screen: LinkedIn exports

`make-home-screen.mjs` renders the redesigned Home screen in the shared
phone frame on the calm brand background (`../shared/brand-frame.mjs`), like
every export. Every image is 1080x1350:

- `home-in-progress.png`: 3 of 5 steps done, with the estimated tax, the
  "Helpful to know" row and a filed 2024 return
- `home-not-started.png`: nothing started yet for 2025
- `home-completed.png`: the 2025 return is filed
- `home-before-after.png`: the old Home next to the new one, both in the
  in-progress state. `before-source.png` is the old Home, captured from the
  commit before the redesign.

The data is fake. Use a local/test backend only, never a real customer's account:

1. Set up the Return Review demo account and data (see `../review-screen/README.md`).
2. Build the web app against that backend and render. The script seeds each
   state itself with `seed-home-states.sql`, so it needs the database URL as well:

       DEMO_DATABASE_URL=postgresql://postgres@localhost:54322/postgres \
       DEMO_SUPABASE_URL=http://localhost:54321 DEMO_SUPABASE_ANON_KEY=<anon key> \
         node marketing/home-screen/make-home-screen.mjs --rebuild

`seed-home-states.sql` also works on its own, for example
`psql "$DEMO_DATABASE_URL" -v state=submitted -f marketing/home-screen/seed-home-states.sql`.
It takes one of these states: `not_started`, `in_progress`, `submitted`, `completed`.
The app's clock is set to 10 February 2026, so the deadline pill reads
"49 days left".
