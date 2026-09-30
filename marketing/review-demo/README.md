# Review-screen demo video

`make-review-demo.mjs` renders the "Review your tax return" walkthrough
(4:5 and 1:1 MP4s, GIF, still) from the real signed-in web build.

It needs a local/test backend with a made-up, complete draft return: create the
account `demo@example.com` (password `DemoPass-2026`, or set `DEMO_EMAIL` /
`DEMO_PASSWORD`), mark its profile identity-verified, then run
`seed-demo-return.sql`. Build the web app against that backend and render:

    DEMO_SUPABASE_URL=http://localhost:54321 DEMO_SUPABASE_ANON_KEY=<anon key> \
      node marketing/review-demo/make-review-demo.mjs --rebuild

Never point it at a real customer's account.
