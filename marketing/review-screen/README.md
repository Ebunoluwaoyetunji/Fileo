# Return Review screen: LinkedIn exports

`make-review-screen.mjs` renders the redesigned Return Review screen, in a clean
phone frame like the splash demo, all 1080x1350:

- `review-summary.png`: Summary tab
- `review-calculation.png`: Calculation tab (timeline)
- `review-tax-bands.png`: the "How tax bands work" sheet
- `review-documents.png`: Documents tab
- `review-tabs.mp4`: 60fps, switching between the three tabs

`review-before-after.png` puts the old screen next to the new Summary tab. It
was made by hand from two screenshots, not by the script.

The data is fake. Use a local/test backend only, never a real customer's account:

1. Create the account `demo@example.com` (password `DemoPass-2026`, or set
   `DEMO_EMAIL` / `DEMO_PASSWORD`) with its email confirmed, and mark its profile
   identity-verified.
2. Run `seed-demo-return.sql` against that database. It creates a complete 2025
   draft with made-up figures: Paystack, Upwork and GTBank income, business expenses,
   pension, life assurance and NHF, plus a rent claim that 2025 rules don't allow.
3. Build the web app against that backend and render:

       DEMO_SUPABASE_URL=http://localhost:54321 DEMO_SUPABASE_ANON_KEY=<anon key> \
         node marketing/review-screen/make-review-screen.mjs --rebuild
