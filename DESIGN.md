# Fileo design system

The single source of truth for how Fileo looks and reads. Tokens live in code:
colours in `constants/colors.ts`, type, spacing, radius and icon sizes in
`constants/theme.ts`. Use the tokens. Never hard-code a hex value or a size in
a screen.

## Colour

| Token | Hex | Use it for |
|---|---|---|
| `primaryButton` | `#0B1628` | Every primary button and the active tab icon. White text on it (18:1). |
| `backgroundInverse` | `#0B1628` | Navy surfaces such as the splash. Same navy as `primaryButton`. |
| `primary` | `#0B6E4F` | Accent green: success, savings, positive amounts, ticks, links, selected chips, switches. Not a button colour. |
| `primaryDark` | `#074D37` | Green text that must read small (tax due, totals). |
| `primaryLight` | `#E3F3EC` | Green chips and callouts ("Deductions saved you…", "What's next?"). |
| `heroTint` | `#ECF2EE` | The hero area at the top of summary screens, and the soft circle behind list-row icons. |
| `offWhite` | `#FAFAF8` | Quiet cards on white (the split stat card). |
| `background` | `#FFFFFF` | Screens and the white content sheet. |
| `surface` | `#F7F8FA` | Default card fill. |
| `border` | `#E4E7EB` | Hairline borders and dividers. |
| `textPrimary` | `#111417` | Body text and headings. |
| `textSecondary` | `#5B6470` | Secondary text, labels, captions (5.9:1 on white). |
| `amberTint` / `amberBorder` / `amberText` | `#FBF4E6` / `#EEDDB9` / `#7A5310` | Calm "needs attention" (something missing). Not an error. |
| `danger` | `#D93025` | Errors; solid fill only on buttons that delete data or confirm sign-out (white text 4.8:1); red text on Sign out. |
| `successTint` | `#DCEFE3` | "Completed" / "Submitted" status pills. |
| `disabledSurface` | `#E6E9ED` | Disabled buttons, with `textSecondary` text. |

- Do: navy for the one main action on a screen, and green for good news.
- Don't: use green for buttons, red for "something is missing" (use amber), or gradients on new work.

## Type

- **Playfair Display** (`typography.hero`, 40pt bold) is only for hero numbers,
  such as the tax due on Return Review and Home's estimated tax.
  `typography.heroTitle` (26pt) is Playfair at title size, only for the next
  step on Home's filing card. The serif `typography.display` is for screen
  headlines.
- Everything else uses the system font: `body` 16/22, `bodyStrong` 16/22 semibold,
  `caption` 13/18, `h3` 18/24. Rows use 15pt.
- Section labels are small uppercase (`typography.overline`: 12pt, semibold,
  wider letter spacing, `textSecondary`), for example INCOME SOURCES.
- Amounts use `tabularNumbers` so columns line up: ₦ with commas, no kobo unless non-zero.

## Space, shape, depth

- Spacing scale: 4, 8, 16, 24, 32, 48 (`spacing.xs` to `spacing.xxl`). Screens pad 24.
- Cards: 20pt radius (`radii.lg`). Buttons, chips and tab pills are fully round (`radii.full`).
- **No shadows.** Show depth with a flat tint and a hairline border.
  - Do: a white card with `border` on a tinted hero.
  - Don't: `shadow*` or `elevation` props.
- Tap targets are at least 44pt. Layouts must survive larger system text: let text wrap, and don't fix heights.

## Icons

- Lucide only (`lucide-react-native`). `LucideProvider` in `app/_layout.tsx`
  sets the stroke (1.75), the default size (20) and the colour (`textPrimary`).
- Sizes: 16 (inline with small text), 20 (default), 24 (tab bar, list leads,
  prominent actions). 40 is only for large decorative icons in empty states.
- Don't pass `strokeWidth`. Pass a size only when it isn't 20.
- Custom illustrations (onboarding, confirmation seals, the wordmark) stay as images.

## Components

- **Button** (`components/ui/Button`): one style per variant, all pill-shaped.
  - `primary`: navy, for the main action. Use one per screen.
  - `secondary`: white with a border and navy text, for the alternative (Cancel, Try again).
  - `secondaryDanger`: the secondary style with red text, for leaving actions that delete nothing (Sign out on Profile).
  - `destructive`: solid red with white text.
  - `loading` keeps the colour and shows a spinner. `disabled` turns flat grey.
- **When to use solid red:** only for actions that delete data (Delete
  document) and for the final confirm in the sign-out sheet. Sign out itself
  isn't destructive, so its entry point is `secondaryDanger`.
  - Do: Profile → "Sign out" (`secondaryDanger`) → sheet → "Sign out" (`destructive`) and "Cancel" (`secondary`).
  - Don't: a solid red button that only opens a confirmation, or red fill for anything that can be undone.
- **Card** (`components/ui/Card`): 20pt radius, hairline border, 24pt padding.
  In lists, use 16pt side padding with hairline dividers between rows.
- **HeroScroll** (`components/layout/HeroScroll`): a summary hero on
  `heroTint` above a white rounded sheet. Use it on summary screens (Home,
  File tab, Profile, Filing detail, Confirmation, Return Review), not on forms
  or lists.
- **SegmentedTabs** (`components/ui/SegmentedTabs`): switches views inside one
  screen, with 2 to 4 short labels. It is not for navigation.
- **Timeline** (`components/ui/Timeline`): a step-by-step working or a status
  history. Section names are small green text, and the result step uses `tone="final"`.
- **BottomSheet** (`components/ui/BottomSheet`): confirmations and short
  explanations. It has one primary button and a secondary way out.
- **SegmentedRing** (`components/ui/SegmentedRing`): progress through a
  fixed number of steps, as a ring split into equal segments with gaps and
  rounded ends. Props: `total`, `completed`, and children for the centre
  ("3/5", or a tick when done). Done segments are `primary`, the rest
  `border`. The fill sweeps in when the count changes, and jumps straight
  there with Reduce Motion on. Use 84pt with a 7pt stroke, or 64pt with a 6pt
  stroke on narrow phones and large text.
  - Do: one ring per card, for steps the user works through.
  - Don't: use it for amounts or percentages (it counts steps).
- **Learn card** (Home's "Helpful to know"): a horizontal, swipeable row of
  200pt white cards, each with a hairline border, a 36pt `heroTint` icon
  circle, a short title (15pt semibold) and one line of `caption`. Let the
  next card peek in so the row reads as swipeable. Each card opens a
  BottomSheet explainer from `components/filing/HelpSheets` with a "Got it"
  button.
- **Deadline pill**: a round `heroTint` pill with a 16pt icon and
  `primaryDark` caption text ("Due 31 Mar 2026 · 49 days left"). It turns
  amber once overdue ("Overdue by 12 days"). Deadlines live in
  `constants/deadlines.ts`, one date per tax year.
- **List rows with icon circles**: a 36pt `heroTint` circle with a 16 or 20pt
  green icon, the label, and a right-aligned value.
- **Callouts**: amber for "needs attention", green (`primaryLight`) for
  information and good news.

## Tone of voice

Plain English, short sentences, no jargon. Say what happened and what to do next.

| Do | Don't |
|---|---|
| "Upwork statement not uploaded" | "Missing document: platform_statement (Upwork)" |
| "Couldn't save. Check your connection and try again." | "Error 503: request failed" |
| "Only the part above ₦3,200,000 is taxed at 24%." | "Marginal rate applicable to the top band: 24%" |
| "Deductions saved you ₦115,392" | "Tax delta attributable to reliefs" |
