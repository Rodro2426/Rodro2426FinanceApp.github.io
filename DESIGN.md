---
name: Pockets
description: A warm, rounded budget app for the Colombian quincena, and the website that shows it off.
colors:
  page: "#f7f5f3"
  surface: "#ffffff"
  sunk: "#efecea"
  ink: "#201e1d"
  ink-2: "#57534f"
  ink-3: "#6b6764"
  line: "#e2dedb"
  red: "#ec3013"
  red-press: "#d42a10"
  red-wash: "#fde4df"
  navy: "#232e7a"
  navy-deep: "#161d55"
  lilac: "#c3c9f2"
  tint-green: "#dcf3e3"
  tint-blue: "#d9e8fb"
  tint-lilac: "#ece3fb"
  tint-butter: "#fbeec9"
  tint-sky: "#dfeaf8"
  tint-violet: "#e6e1fa"
  tint-rose: "#fde0dc"
  tint-mist: "#e3e6f7"
typography:
  display:
    fontFamily: "ui-rounded, \"SF Pro Rounded\", \"Nunito\", -apple-system, BlinkMacSystemFont, \"Segoe UI\", system-ui, sans-serif"
    fontSize: "clamp(3.1rem, 6.6vw, 5.75rem)"
    fontWeight: 900
    lineHeight: 0.95
    letterSpacing: "-0.04em"
  headline:
    fontFamily: "ui-rounded, \"SF Pro Rounded\", \"Nunito\", -apple-system, BlinkMacSystemFont, \"Segoe UI\", system-ui, sans-serif"
    fontSize: "clamp(2.4rem, 4.6vw, 4rem)"
    fontWeight: 900
    lineHeight: 1.04
    letterSpacing: "-0.035em"
  title:
    fontFamily: "ui-rounded, \"SF Pro Rounded\", \"Nunito\", -apple-system, BlinkMacSystemFont, \"Segoe UI\", system-ui, sans-serif"
    fontSize: "1.3rem"
    fontWeight: 800
    lineHeight: 1.04
    letterSpacing: "-0.02em"
  lede:
    fontFamily: "ui-rounded, \"SF Pro Rounded\", \"Nunito\", -apple-system, BlinkMacSystemFont, \"Segoe UI\", system-ui, sans-serif"
    fontSize: "clamp(1.08rem, 1.45vw, 1.3rem)"
    fontWeight: 600
    lineHeight: 1.55
  body:
    fontFamily: "ui-rounded, \"SF Pro Rounded\", \"Nunito\", -apple-system, BlinkMacSystemFont, \"Segoe UI\", system-ui, sans-serif"
    fontSize: "17px"
    fontWeight: 600
    lineHeight: 1.55
  label:
    fontFamily: "ui-rounded, \"SF Pro Rounded\", \"Nunito\", -apple-system, BlinkMacSystemFont, \"Segoe UI\", system-ui, sans-serif"
    fontSize: "14px"
    fontWeight: 800
    lineHeight: 1.3
rounded:
  sm: "12px"
  window: "16px"
  card: "20px"
  panel: "24px"
  art: "28px"
  section: "48px"
  section-mobile: "36px"
  pill: "999px"
spacing:
  gutter: "20px"
  container: "1240px"
  nav: "64px"
  nav-mobile: "58px"
  section-sm: "72px"
  section-md: "100px"
  section-lg: "120px"
components:
  button-primary:
    backgroundColor: "{colors.red}"
    textColor: "{colors.surface}"
    typography: "{typography.label}"
    rounded: "{rounded.pill}"
    padding: "0 26px"
    height: "52px"
  button-primary-hover:
    backgroundColor: "{colors.red-press}"
  button-small:
    backgroundColor: "{colors.red}"
    textColor: "{colors.surface}"
    rounded: "{rounded.pill}"
    padding: "0 18px"
    height: "40px"
  button-ghost:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.pill}"
    padding: "0 26px"
    height: "52px"
  button-ghost-hover:
    backgroundColor: "{colors.sunk}"
  button-light:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.navy}"
    rounded: "{rounded.pill}"
    padding: "0 26px"
    height: "52px"
  chip:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    typography: "{typography.label}"
    rounded: "{rounded.pill}"
    padding: "7px 14px"
  fragment-card:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.card}"
    padding: "12px 14px"
  pocket-tile:
    backgroundColor: "{colors.tint-blue}"
    textColor: "#1c4f87"
    rounded: "{rounded.card}"
    padding: "14px 18px"
  lang-toggle:
    backgroundColor: "{colors.sunk}"
    textColor: "{colors.ink-3}"
    rounded: "{rounded.pill}"
    height: "32px"
---

# Design System: Pockets

## Overview

**Creative North Star: "The Pocket on the Kitchen Table"**

Pockets looks like the app it is: a warm off-white page, white cards that sit on it like slips of paper, near-black ink, and one red voice that says "do this". The website (`app/public/site/`) deliberately inherits the app's own surfaces (`app/src/styles.css`) rather than inventing a marketing skin; it adds a stage for the real app to perform on: a 3D iPhone, pastel stage tints that wash behind each feature, and a deep navy close taken from the lock screen and the logo.

Density is relaxed and friendly. Type is rounded and heavy, headlines are short and balanced, and every claim is shown on a real app screen with sample data. Colour carries meaning, not decoration: pocket hues identify pockets, red marks the primary action, navy marks the brand and the ending.

The system serves two surfaces from one core. The app (phone-sized column, 15px body, oklch pocket tints computed from a hue) and the website (wide 1240px container, 17px body, the same tints frozen as hex stage washes) share ground, ink, red, rounded type, pastel pocket colour, white cards and navy.

**Key Characteristics:**
- Warm off-white ground, white cards, near-black ink; never pure grey or pure black text.
- One red, reserved for the primary action.
- Rounded system type at heavy weights (800 to 900) for every heading.
- Pastel pocket tints, each paired with a deep ink of the same hue.
- Pill shapes for everything you tap; large soft radii for everything you look at.
- Real app fragments as the only illustration.

## Colors

A warm neutral paper palette with one hot red action, an indigo-navy brand voice, and a family of pastel pocket tints.

### Primary
- **Pockets Red** (`red`): the app's accent (`--color-accent` in the app). Only on the primary action: "Open Pockets" buttons, the nav button, and the red wash icon of a bill alert. Pressed or hovered it deepens to **Red Press** (`red-press`).
- **Red Wash** (`red-wash`): the pale red tile behind a red stroke icon, as in the bill-alert fragment.

### Secondary
- **Pocket Navy** (`navy`): the logo's indigo and the app's lock screen. Used for the second line of the hero headline, outline icons in the details list, the phone's back, the focus ring, and the closing frame's centre. **Navy Deep** (`navy-deep`) is the close's outer edge and the footer.
- **Card Lilac** (`lilac`): the logo's lavender card. Only as the highlighted second line of the headline on navy.

### Tertiary: pocket tints
The app computes a pocket's tint as `oklch(0.94 0.04 <hue>)` with ink `oklch(0.42 0.1 <hue>)` (dark: `0.31 0.055` / `0.87 0.09`). The website freezes eight of them as hex stage washes, one per feature scene: **Mint** (`tint-green`), **Sky** (`tint-blue`), **Lavender** (`tint-lilac`), **Butter** (`tint-butter`), **Pale Sky** (`tint-sky`), **Violet Mist** (`tint-violet`), **Rose** (`tint-rose`), **Indigo Mist** (`tint-mist`). A tint always pairs with the deep ink of its own hue when it carries text (the Transport tile uses `#1c4f87` on Sky).

### Neutral
- **Warm Paper** (`page`): the ground of both app and site, and the iPhone theme colour.
- **Card White** (`surface`): cards, fragments, chips, the install and FAQ bands.
- **Sunk** (`sunk`): hover fills, the language toggle track, the browser window bar.
- **Ink** (`ink`): all primary text. **Ink 2** (`ink-2`) for ledes and paragraph text, **Ink 3** (`ink-3`) for captions, notes and inactive labels.
- **Line** (`line`): hairline dividers, chip and ghost-button inner strokes.

### Named Rules
**The One Red Rule.** Red belongs to the primary action. If two red things compete on a screen, one of them is wrong.

**The Same Hue Rule.** A pastel tint never carries text in plain ink alone; it takes the deep ink of its own hue.

## Typography

**Display Font:** ui-rounded / SF Pro Rounded (with self-hosted Nunito 500 to 900 on non-Apple systems, then system sans)
**Body Font:** the same stack
**Label Font:** the same stack

**Character:** one rounded family at heavy weights; friendly without being childish, because the headlines stay tight (negative tracking, balanced wrapping) and short.

### Hierarchy
- **Display** (900, `clamp(3.1rem, 6.6vw, 5.75rem)`, 0.95): hero and closing headlines only. Second line set in navy (on paper) or lilac (on navy).
- **Headline** (900, `clamp(2.4rem, 4.6vw, 4rem)`, 1.04): section headings. Feature headings in the story run slightly smaller (`clamp(2.3rem, 4.2vw, 3.75rem)`).
- **Title** (800, 1.3rem, -0.02em): list item and step headings.
- **Lede** (600, `clamp(1.08rem, 1.45vw, 1.3rem)`, max 34ch): the one sentence under a headline, in Ink 2.
- **Body** (600, 17px on the site / 15px in the app, 1.55): paragraphs in Ink 2, max 36 to 60ch.
- **Label** (800, 13 to 15px): buttons, chips, nav, rail, toggles. Sentence case, never uppercase.

### Named Rules
**The Heavy Rounded Rule.** Headings are 800 or 900 with negative tracking (-0.02em to -0.04em). Body text is 600, not 400; the rounded face looks thin at regular weight.

## Layout

The site centres a 1240px container with a 20px gutter (safe-area aware). The sticky nav is 64px (58px under 860px) on a 92% paper wash that gains a hairline once scrolled. The hero splits 5/12 copy and 7/12 phone stage; the story pairs a sticky phone stage with scrolling feature blocks in two equal columns; the FAQ splits 4/7. Sections breathe at 80 to 120px block padding, dropping to 72px under 860px, where every grid becomes one column and the story stage becomes an opaque window (56svh) above the text so blocks slide under it. Breakpoints: 1080px (side rail hides, fragments pull in), 860px (single column), 420px (tighter buttons and phone).

The app is a single phone-sized column (max 440px), framed as a 402px rounded phone with a soft shadow on wide screens.

## Elevation & Depth

Depth is soft and warm: shadows are tinted with the ink colour, long and low-opacity, and used to float real app pieces. Flat paper and white bands do the structural work; the shadow tells you something is lifted off the page.

### Shadow Vocabulary
- **Red lift** (`0 10px 24px -12px rgba(236, 48, 19, 0.7)`): under the primary button only.
- **Fragment float** (`0 24px 40px -18px rgba(32, 30, 29, 0.35), 0 2px 6px rgba(32, 30, 29, 0.06)`): app fragments floating at depth around the phone.
- **Window** (`0 50px 90px -50px rgba(32, 30, 29, 0.45), 0 0 0 1px #e2dedb`): the desktop browser window.
- **Toggle knob** (`0 1px 3px rgba(45, 43, 43, 0.16)`): the selected segment of a toggle.
- **Floor shadow** (blurred radial ellipse of ink at 26%): under the 3D phone.
- App scale: `--shadow-sm/md/lg` (`0 1px 2px`, `0 3px 10px`, `0 12px 32px` of #2d2b2b at 14/16/22%).

### Named Rules
**The Warm Shadow Rule.** Shadows are ink or red tinted, offset downward, and blurred. No hard offset shadows, no neutral black glows.

## Shapes

Everything you tap is a pill (999px): buttons, chips, nav links, language toggle. Everything you look at has big soft corners: fragments 20px, panels 24px, step art 28px, section bands 48px on top (36px on phones) so the install band and navy close rise like sheets. The phone itself is drawn at 54px outer and 44px screen radius. Hairlines (1px Line) divide lists and FAQ rows; ghost buttons and chips use an inset 1 to 1.5px stroke instead of a border.

## Components

### Buttons
- **Shape:** pill (999px), 52px tall, 40px for the nav size.
- **Primary:** Pockets Red on white text, weight 800, 19px, with the red lift shadow.
- **Hover / Focus:** hover (fine pointers only) deepens to Red Press; press scales to 0.97 over 160ms ease-out; focus is a 3px navy outline offset 3px (white on navy).
- **Ghost:** Card White with an inset Line stroke; hover to Sunk. Used for secondary actions like "Copy link".
- **Light:** white with navy text and a deep shadow, only on the navy close.
- **Arrow link:** bold ink text with a stroked arrow that nudges 3px right on hover; the quiet partner of a primary button.

### Chips
- **Style:** Card White, inset 1px Line, 800 weight 14px, pill. Static facts under a feature, not filters.

### Cards / Containers
- **Corner Style:** 20px (fragments), 24 to 28px (panels and art frames).
- **Background:** Card White on Warm Paper, or a pocket tint with its own deep ink.
- **Shadow Strategy:** fragment float when lifted; otherwise flat.
- **Internal Padding:** 12 to 18px for fragments.

### Navigation
- Sticky, paper wash, brand mark plus a 900-weight wordmark, pill text links in Ink 2 that fill Sunk on hover, a pill language toggle (Sunk track, white selected knob), and the small red button. Under 860px the links hide; brand, toggle and button remain.

### 3D Phone (signature, website)
A CSS-built iPhone (slice, front with bezel and island, navy back with the logo and camera) showing real app screenshots. It turns 360° on its Y axis when the active feature changes (900ms ease-in-out), swapping the screen while its back faces you, as the stage tint crossfades to the scene's pocket colour (600ms). On fine pointers it tilts toward the cursor. Reduced motion turns the spin off and crossfades the screen in 200ms.

### App Fragment (signature, website)
A real piece of the app UI (a bill alert, a pocket tile with its emoji and remaining amount, a settle-up line with an initial avatar) floating in front of the phone at its own depth. Fragments are the only illustration: no invented objects.

### Ground Texture "Billete Pockets" (signature, website)
The page ground is printed the way a peso bill is, built only from Pockets' own pieces (owner's choice, 2026-11-11). Two files in `app/public/site/tex/`:
- `billete-hero.svg` (1440×900, once at the top, centred; on phones 1100px wide and centred on the phone): a lilac-to-mint colour wash (#e6e1fa → #dcf3e3 at 55%), a watermark of 13 nested outlines of the logo's pocket shape behind the phone (navy at 8%), a microprinted ring reading "CADA PESO EN SU BOLSILLO · POCKETS" (7px, navy at 11%), and an engraved guilloché rosette in the lower-left corner (navy at 6%).
- `billete-tile.svg` (600×140, repeated down the page): four interlaced guilloché wave lines (navy at 5.5%) and one row of 5px microtext (navy at 7%), over a 135° line screen (`--hatch`, 1px navy at 2.8% every 6px).
The texture lives only on Warm Paper. White sections, cards, the phone and the navy close stay clean. On phones the sticky story stage repeats the tile so it never shows a flat block. Nothing from a real banknote (portrait, issuing bank, denomination, serial numbers) is ever used.

### Dark Mode (website)
The website follows the visitor's system setting, with a sun/moon switch beside ES/EN that overrides it (saved in localStorage `pockets-site-theme`; the theme is set before first paint, and switching crossfades once with View Transitions where supported). Dark values are the app's own dark mode: ground #0e0e0d, surface #1d1c1b, sunk #262524, ink #f2efea / #b8b3ad / #9c9791, line #302e2d; pocket tints use the app's dark oklch (L 0.31, C 0.055) with ink (L 0.87, C 0.09); navy words and icons become #aab3ea. The bill texture swaps to `billete-hero-dark.svg` / `billete-tile-dark.svg` (lilac ink #c5cbf2 on the dark ground, a deep indigo-to-teal wash). The phone shows the app's real dark screens (`screens/{es,en}-dark/`). The red action, the navy close and the white close button are the same in both themes.

## Do's and Don'ts

### Do:
- **Do** set the page on Warm Paper (#f7f5f3) with white cards; it is the iPhone theme colour and the app's own ground.
- **Do** keep Pockets Red (#ec3013) for the one primary action in view.
- **Do** pair every pastel tint with the deep ink of its own hue.
- **Do** use the rounded stack at 800 to 900 for headings and 600 for body text.
- **Do** make tappable things pills (999px) at least 44px tall.
- **Do** show real app screens and fragments, labelled as sample data.
- **Do** ease with `cubic-bezier(0.23, 1, 0.32, 1)` for entrances and presses, `cubic-bezier(0.77, 0, 0.175, 1)` for the phone turn, and honour Reduce Motion.

### Don't:
- **Don't** use red for decoration, headings or icons that aren't the main action or a bill alert.
- **Don't** put plain ink on a pocket tint, or text on a tint without its hue's deep ink.
- **Don't** use hard offset shadows or neutral black glows; shadows are warm and blurred.
- **Don't** set body text at 400 weight or headings below 800.
- **Don't** draw stock or invented objects on the website or in the app when a real app fragment can show the point. (The video ads' lavender clay world is a separate marketing medium and is not banned by this rule.)

### In the app (2026-11-11)
- **Ground:** the app uses the same "Billete Pockets" ground as the website on its main screens and full pages (`--ground` in `app/src/styles.css`: the hero plate at the top, the tile and the line screen, over `--page`, so a custom background colour still shows). Sheets, cards and the welcome and lock screens stay as they were. Files: `app/public/tex/`.
- **Engraved safe-to-spend card:** the "Puedes gastar" card carries a banknote engraving (wave lines, a rosette beside the amount, one microtext row) in its own ink, one file per mood: `card-green`, `card-yellow`, `card-red`, each with a `-dark` twin. Class `bill bill-<tone>`.
- **Motion tokens:** `--ease-out: cubic-bezier(.23,1,.32,1)` for presses and arrivals; `--ease-drawer: cubic-bezier(.32,.72,0,1)` for sheets (open 320ms, close 220ms). Presses 160ms with no overshoot; tab switch 8px over 180ms; chips animate only colour and press; bars fill with `clip-path`, never `width`.
- **Signature, "la plata se mueve":** when the safe-to-spend amount changes, its digits roll to the new value (700ms ease-out, `ui/RollingMoney.tsx`) and, when it goes down, the amount spent lifts off the card. Quiet on first load, while amounts are hidden, and with Reduce Motion.
- **Eye:** hiding or showing amounts blurs the screen's content in for 200ms (`.eye-flip`) instead of swapping in one frame.

### Desktop app: "Tu semana" (2026-11-12)
On a computer (≥1024px wide and ≥560px tall) the logged-in app reads like the week's report, top to bottom, in one calm column. It replaces the sidebar, the two-column masonry of phone cards and the centred modal sheets. Direction contract: `.impeccable/surfaces/app-src-ui-desk-tsx.md`.
- **Top bar** (`TopBar` in `ui/Desk.tsx`), 68px, on the textured ground with a hairline below: mark and wordmark; Inicio, Cuentas, Presupuesto, Análisis, Calendario as text links, the current one in heavier ink with a 2.5px ink underline; Más opens a small menu (Inversiones, Amigos y viajes, Categorías, Reportes). Right: search pill with ⌘K, eye, bell with count, red "+ Agregar", avatar.
- **Column:** 1000px (`--col`) for every tab and page; sections stack with 26–30px between them; nothing flows into uneven columns. Pairs are allowed only for two lists of the same kind, aligned to the top (Próximamente beside Recientes).
- **Home:** the verdict sentence as H1 (46px, 850, −0.032em: "Vas bien, Sofía." / "Con calma esta semana…" / "Esta semana está apretada…", by the week's tone), date and week under it; the engraved safe panel full width (72px number, Hoy / Esta semana / Este mes switch that drives the panel and the pocket lines together); a figures line on hairlines (Patrimonio, Gastado, Ingreso mensual); pocket lines (dot, name and period, a long bar in the pocket's tint and ink, amount and "quedan de"); Próximamente | Recientes; Amigos y viajes as a figures line.
- **Figures, not tiles:** summary numbers sit on hairline rules (`.dh-figs`), never in nested tinted boxes.
- **Side panel:** every sheet opens as a 480px panel on the right (drawer curve, 320ms in / 220ms out) over a light scrim; the page stays in view.
- **Red on desktop:** only "+ Agregar", destructive actions and overdue dates. Section links and small actions are ink with an underline; tags are neutral; due dates are amber at two days or less.
- **Type:** the rounded stack now includes a self-hosted Nunito (`app/public/fonts/`) after SF Pro Rounded, so browsers other than Safari also get rounded headings.
- **Ground:** on desktop the page plate is `billete-hero-desk(.dark).svg`, the same plate without the corner rosette.

