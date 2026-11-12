---
version: 1
slug: "app-src-ui-desk-tsx"
primary_target: "app/src/ui/Desk.tsx"
related_targets: ["app/src/screens/Home.tsx","app/src/App.tsx"]
---

# Pockets web app on a computer (logged-in, ≥1024px)

Mode: Operate. Audience: the owner and friends using Pockets in a browser on a laptop, usually to review the week, catch up on transactions, plan the budget or check investments. Job: see how the week is going at a glance, then act (add, edit, move money) without losing your place. Constraints: every feature the phone app has stays; same visual world (DESIGN.md: warm paper, white surfaces, red action, rounded type, pastel pocket tints, bill texture); Spanish and English; light and dark; the phone layout is untouched.

Chosen in a structure round (second hand): "Tu semana". Replaces the stretched phone layout (sidebar + two-column masonry of phone cards + centred modal sheets).

## Direction contract

THESIS: On a computer, Pockets reads like the week's report, top to bottom, in one calm column, not a dashboard of floating phone cards. It refuses the sidebar-plus-masonry and the bento grid.

OWN-WORLD: The app's own surfaces: warm paper ground with the bill texture, white sections, near-black ink, the red only on "+ Agregar" and destructive actions, pastel pocket tints as the colour of each pocket's line and bar, the engraved safe-to-spend panel as the one hero object, rounded type, tabular numbers.

STORY: The visitor reads a one-sentence verdict on the week, sees the safe number, scans each pocket as a line, sees what's coming and what just happened, and opens anything in a side panel that keeps the page in view.

FIRST VIEWPORT: Slim top bar (mark and wordmark left; Inicio, Cuentas, Presupuesto, Análisis, Calendario, Más as text links; search, eye, bell, red "+ Agregar", avatar right). A 1000px column: the sentence verdict as the H1 with the date under it, then the full-width engraved safe panel (number ~64px, bar, Hoy/Semana/Mes switch), then a quiet row of figures, then the first pocket lines.

FORM: "Tu semana", dealt lead on re-roll 1, position 7 on the ordered list. seed: 6df3b8508e86c210

Signature interaction: details open in a 480px side panel from the right (drawer curve, 320ms in / 220ms out) instead of a centred modal; the Hoy/Semana/Mes switch drives both the safe panel and the pocket lines together.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
