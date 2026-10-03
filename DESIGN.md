# Fileo design system

The single source of truth for how Fileo looks and reads. Tokens live in code:
colours in `constants/colors.ts`, type, spacing, radius and icon sizes in
`constants/theme.ts`. Use the tokens. Never hard-code a hex value or a size in
a screen.

## Colour

| Token | Hex | Use it for |
|---|---|---|
| `primaryButton` | `#0B1628` | Every primary button and the active tab icon. White text on it (18:1). |
| `backgroundInverse` | `#0B1628` | Navy surfaces: the splash and Home's filing card. Same navy as `primaryButton`. |
| `primaryOnDark` | `#5FC79B` | Green on navy (labels, ring segments). `primary` is only 2.9:1 on navy; this is 8.7:1. |
| `textOnDarkMuted` | white at 70% | Secondary text and icons on navy (9.2:1). |
| `faintOnDark` | white at 15% | Faint marks on navy: empty ring segments, skeletons and connector lines. |
| `surfaceOnDark` | white at 8% | Soft fill for small shapes on navy (onboarding step circles). |
| `hairlineOnDark` | white at 12% | Hairline borders on navy. |
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

- **Only one Playfair element per screen.** It is the screen's focal point.
  Everything else supports it in the system font.
  - `typography.hero` (Playfair 40pt bold) is for a hero number, such as the
    tax due on Return Review.
  - `typography.heroTitle` (Playfair 26pt) is for a title at the same level,
    such as the next step on Home's filing card.
  - Don't: a second Playfair number or heading on the same screen. For
    example, Home's estimated tax is bold body text (32pt), not Playfair.
- The serif `typography.display` is for onboarding and screen headlines.
- A greeting is a friendly hello, not a heading: 20pt, medium weight.
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
  - `inverse`: white with navy text. **On dark surfaces, the primary button
    is white with navy text** (Home's filing card). Use one per dark card.
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
- **OnboardingSteps** (`components/ui/OnboardingSteps`): Timeline's idea drawn
  for navy, as a short list of steps with no values (onboarding screen 2).
  - Each row has a Lucide icon in a 44pt circle (`primaryOnDark` icon,
    `surfaceOnDark` fill, 1pt `hairlineOnDark` border), a white medium-weight
    title, and a second line in caption `textOnDarkMuted`.
  - Thin `faintOnDark` connectors run between the circles, not through them.
  - The list is left-aligned with the headline. Keep it to four rows or fewer.
  - Motion: rows fade and rise 120ms apart, each connector draws downward as
    its row arrives, and the last icon gets a brief soft highlight. It uses
    opacity and transforms only, on the native driver. With reduce motion,
    the rows fade in together.
- **BottomSheet** (`components/ui/BottomSheet`): confirmations and short
  explanations. It has one primary button and a secondary way out.
- **SegmentedRing** (`components/ui/SegmentedRing`): progress through a
  fixed number of steps, as a ring of equal segments with gaps and rounded
  ends. Content can go in the centre.
  - On a dark card (Home's filing card), keep it small, 44pt with a 4pt
    stroke. Put it in the top-right corner, level with the card's label row,
    never beside the title, so the title keeps the full width.
  - On a dark card, done segments are `primaryOnDark` and the rest
    `faintOnDark`. The centre is 12pt semibold white "3/5", or a 16pt white
    clock (submitted) or tick (filed).
  - It sweeps in when the count changes, and jumps straight there with
    Reduce Motion on. Use one ring per card, and only for steps, not amounts.
- **SegmentedProgress** (`components/ui/SegmentedProgress`): the same idea
  as a thin bar, one short 24 x 4pt segment per step with text beside it
  ("3 of 5 steps"). It's kept for light surfaces and isn't used on Home.
- **Learn card** (Home's "Helpful to know"): a horizontal, swipeable row of
  200pt white cards, each with a hairline border, a 36pt `heroTint` icon
  circle, a short title (15pt semibold) and one line of `caption`. Let the
  next card peek in so the row reads as swipeable. Each card opens a
  BottomSheet explainer from `components/filing/HelpSheets` with a "Got it"
  button.
- **Deadline**: by default a plain muted line (`caption`, `textSecondary`,
  or `textOnDarkMuted` on navy) with a 16pt calendar icon: "Due 31 Mar 2026 · 49 days left".
  - In the last 14 days, it becomes an amber pill with the same text.
  - Once past, it's an amber pill: "Overdue by 12 days".
  - Deadlines live in `constants/deadlines.ts`, one date per tax year.
- **Home filing card**: a solid navy (`backgroundInverse`) card, with no
  border and a 20pt radius.
  - Order: label (green overline in `primaryOnDark`) and ring on one row →
    Playfair title in white → a muted context line only when it helps ("5
    steps · about 10 minutes", "Submitted 12 Feb 2026") → the deadline →
    one `inverse` button.
  - Muted text and icons on the card are `textOnDarkMuted`. The amber
    deadline pill keeps its own light fill, so it reads the same on navy.
  - Spacing: 8 above the title, 16 above the first line under it, 8
    between lines, 24 above the button.
  - An error isn't shown on navy: it stays a compact white card.
- **Error cards**: keep them compact, with no Playfair: a 20pt alert icon, a
  regular-weight 18pt title ("Couldn't load your return"), one line of
  helper text and a secondary "Try again" button.
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
