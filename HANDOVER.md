# Fileo handover

Everything you need to pick up Fileo: what it is, how to run and ship it, what
is still pretend, and what is left to build.

## What Fileo is

Fileo helps freelancers and creators in Nigeria file their personal income tax
return. You tell it where you earn (Paystack, Upwork, your bank and so on),
upload your statements, check the income it finds, add your deductions, and
review the tax you owe before you submit.

It is an Expo (React Native) app for Android, iOS and the web, with Supabase
behind it for sign-in, the database, file storage and two server functions.

## What works today

- **Onboarding:** three intro screens, then Create Account.
- **Accounts:** sign up, email confirmation, sign in, reset password, and an
  identity check with BVN or NIN. The identity check is a mock (see below).
- **Filing a return, in five steps:**
  1. Choose where you earn.
  2. Upload your statements (PDF, JPG, PNG or HEIC, up to 10 MB, kept in a
     private bucket).
  3. Confirm your income. With the user's permission, Fileo reads statements
     and suggests amounts. The reading is a mock for now (see below).
  4. Add your deductions.
  5. Review and submit.
- **Tax calculation:** done on the server for the 2025 and 2026 rules.
  Worked examples are in `supabase/tests/tax_worked_examples.sql`.
- **Missing items:** Return Review lists anything still missing and takes
  you straight to fix it.
- **After filing:** Home, the File tab, Documents, filing history and
  filing details.
- **Profile:** edit your profile, switch AI reading on or off, sign out.
- **Legal and help:** Privacy, Terms, the FAQ and a Send feedback link, which
  opens the Google Form in `constants/app.ts`.

## Run it on your computer

1. Install Node.js (LTS), then run `npm install` in the project folder.
2. Copy `.env.example` to `.env` and fill in the two values from your
   Supabase project (Project Settings, then API):
   - `EXPO_PUBLIC_SUPABASE_URL`
   - `EXPO_PUBLIC_SUPABASE_ANON_KEY` (the anon/publishable key, never the
     service role key)
3. Run `npx expo start`. Press `a` for an Android emulator, `w` for the web,
   or scan the QR code with Expo Go.

## Build the Android APK

1. Sign in to Expo: `npx eas-cli login`.
2. The build servers don't receive your `.env` file, because it is
   gitignored. Add the same two `EXPO_PUBLIC_` values as environment variables
   on expo.dev (your project, then Environment variables, for the preview
   environment). If an APK can't reach Supabase, this is usually why.
3. Run `npx eas-cli build -p android --profile preview`.
4. When it finishes, open the link it prints and install the APK on your phone.

`--profile production` makes a Play Store build instead. iOS isn't set up yet.

## Update the web version

1. Run `npx expo export --platform web`. This writes a static site to `dist/`.
2. Upload the contents of `dist/` to your web host. The repo has no hosting
   setup of its own; one easy option is EAS Hosting with `npx eas-cli deploy`.

The web build also reads the two `EXPO_PUBLIC_` values from `.env` when you
export.

## Supabase: database and functions

Run these from the project folder (they work the same in Windows CMD).

- Sign in and connect once:
  - `npx supabase login`
  - `npx supabase link --project-ref YOUR_PROJECT_REF`
- **Database changes** live in `supabase/migrations/`, one file per change,
  oldest first. To apply any new ones to your project, run
  `npx supabase db push`. Each file is also safe to paste into the dashboard's
  SQL Editor and run.
- **Functions** live in `supabase/functions/`:
  - `verify-identity` checks a BVN or NIN.
  - `extract-document` reads a statement and suggests the income.

  Deploy one after you change it:
  - `npx supabase functions deploy verify-identity`
  - `npx supabase functions deploy extract-document`
- **Function secrets:**
  - Set one with `npx supabase secrets set NAME=value`.
  - See which are set with `npx supabase secrets list`.
  - Redeploy the function after changing its secrets.
- **Tests:**
  - `supabase/tests/tax_worked_examples.sql` checks the tax maths. Paste it
    into the SQL Editor; every row should say PASS.
  - `supabase/tests/extraction/` holds the statement-reading checks and
    sample files.

## Mock parts, and how to make them real

Both mocks are switched by a function secret. The app and the database don't
change.

- **Identity check (BVN / NIN):** set by `IDENTITY_PROVIDER`. It is `mock`
  today, which only checks the format.
  1. Finish `supabase/functions/_shared/identity/dojahProvider.ts`. The steps
     are written at the top of that file.
  2. Set the secrets `DOJAH_APP_ID`, `DOJAH_SECRET_KEY` and `DOJAH_BASE_URL`.
     Use the sandbox address while testing and the live one after.
  3. Set `IDENTITY_PROVIDER` to `dojah` and redeploy `verify-identity`.
- **AI statement reading:** set by `AI_PROVIDER`. It is `mock` today, which
  returns made-up results at no cost. The real Anthropic reader is already
  built.
  1. Set the secret `ANTHROPIC_API_KEY`.
  2. Optionally set `AI_MODEL`; leave it unset to use the default in
     `anthropicProvider.ts`.
  3. Set `AI_PROVIDER` to `anthropic` and redeploy `extract-document`.
  4. To try it on the sample statements first, use
     `supabase/tests/extraction/try-real-provider.mjs`.

## Secrets: names and where they live

Never put these values in the app or in the repo.

- **In the app** (`.env` locally, and expo.dev environment variables for
  builds). These are public by design:
  - `EXPO_PUBLIC_SUPABASE_URL`
  - `EXPO_PUBLIC_SUPABASE_ANON_KEY`
- **In Supabase function secrets** (Edge Functions, then Secrets, or
  `npx supabase secrets set`):
  - `IDENTITY_PROVIDER`
  - `DOJAH_APP_ID`
  - `DOJAH_SECRET_KEY`
  - `DOJAH_BASE_URL`
  - `AI_PROVIDER`
  - `ANTHROPIC_API_KEY`
  - `AI_MODEL`
- **Provided by Supabase automatically.** Don't set these yourself:
  - `SUPABASE_URL`
  - `SUPABASE_SERVICE_ROLE_KEY`
  - `SUPABASE_SECRET_KEYS`

  The service role key must only ever live there.

## Still to build

- **Real identity check:** finish the Dojah provider (above).
- **Real AI reading in production:** switch `AI_PROVIDER` (above) and keep an
  eye on cost.
- **Real submission:** nothing is sent to FIRS or a state tax office yet.
  Submitting marks the return as submitted inside Fileo only, and the steps
  on the confirmation screen are illustrative.
- **Emails:**
  - "Send upload link to my email" on Upload doesn't send anything yet.
  - No confirmation email is sent.
- **State of residence:** the profile has a `state` field, and Return Review
  shows it when it is set. Nothing in the app lets the user set it yet; add it
  to Edit Profile.
- **Screens without a final design:** Profile, Edit Profile, Notifications
  and Reset Password work, but their layouts are placeholders.
- **Active sessions on Profile:** these are sample data. There is no session
  list behind them yet.
- **Platform logos:** placeholders (`components/ui/PlatformIcon.tsx`).
- **iOS:** no iOS build setup yet (bundle identifier, signing).
- **Before launch:** set `SHOW_TESTING_NOTICE` in `constants/app.ts` to
  `false`. It shows the "testing" notices on Create Account, the identity
  check and Upload.

## Where things are

- **Design rules:** `DESIGN.md` covers colours, type, spacing, buttons,
  icons, components and onboarding. Follow it for any new screen.
- **Colours and sizes in code:** `constants/colors.ts` and
  `constants/theme.ts`.
- **Legal and help text:** `content/legal/`.
- **Marketing files:** `marketing/`. Each folder has its script next to the
  files it makes:
  - `onboarding/`: stills of the three intro screens
    (`node marketing/onboarding/make-stills.mjs`).
  - `home-screen/`, `review-screen/`, `review-demo/`: stills and videos of
    those screens.
  - `splash-demo/`, `tiktok-demo/`: the app's opening and a full
    walkthrough.
  - `promo/`: the promo film (see its README).
  - `shared/`: the branded frame they all use.
