# Design: vellum

schemd's site is a drafting table. Each page is a sheet of vellum lying on it: matte, slightly translucent, with the sheet underneath showing faintly through. Engineers have always worked this way: a tracing laid over a drawing, a checker's copy laid over the original. schemd does the same thing in software, since the text a person writes is traced into a drawing, so the metaphor carries real meaning rather than decoration.

The previous design, "Datasheet" (October 2026), read as distinctive but dated. This one keeps its discipline (plain words, no template chrome, colour with a meaning) and adds depth, softness and motion that answers the reader.

## Subject, audience, job

- **Subject:** a compiler that turns lines of text into schematic drawings (electrical, digital, quantum, UML).
- **Audience:** engineers writing documentation, educators and students, and technical writers who already work in Markdown.
- **Primary job:** show that a line of text becomes a clean drawing, let a visitor try it at once, and answer exactly what each part accepts.

## Tokens

### Colour

| Token             | Day       | Light table | Use                                                                    |
| ----------------- | --------- | ----------- | ---------------------------------------------------------------------- |
| `--table`         | `#DCE2E9` | `#1A2230`   | the drafting table behind every sheet                                  |
| `--bg` vellum     | `#F7F9FB` | `#222C3B`   | the sheet; drawn at 86 % opacity with a light blur                     |
| `--ink`           | `#14213D` | `#E6ECF4`   | drafting ink: text and the drawings' own fallback colour               |
| `--ink-mute`      | `#55606F` | `#A9B4C3`   | graphite: secondary text, captions                                     |
| `--line`          | `#CDD5DF` | `#364357`   | the edge of a sheet, rules inside it                                   |
| `--accent` pencil | `#2348C8` | `#8FB0FF`   | links and the focus ring: the blue pencil a checker writes with        |
| `--mark`          | `#FFE45C` | `#E8C93A`   | the checker's highlighter: the current page, a traced net, a selection |

Ink is a deep navy, never black, and the table is a cool grey-blue, never cream. The highlighter is the one loud colour; it appears only where something is being checked or is current, which is how a checker uses it on a drawing ("yellow-lining" a net once it has been traced). Drawings keep schemd's own net colours.

### Type

One family in two cuts: **Atkinson Hyperlegible Next** for everything and **Atkinson Hyperlegible Mono** for source. They share their skeleton, so source sits naturally in prose, yet the mono is plainly different. Both were drawn for legibility, which suits a site that teaches.

| Role                    | Face                                | Size / leading                   |
| ----------------------- | ----------------------------------- | -------------------------------- |
| Display (home title)    | Next, weight 800, tracking −0.025em | clamp(44px, 6vw, 76px) / 1.0     |
| Page title              | Next, weight 750, tracking −0.02em  | 44 px / 1.1                      |
| Section heading         | Next, weight 700, tracking −0.01em  | 26 px / 1.2                      |
| Body                    | Next, weight 400                    | 17 px / 1.6, measure under 72 ch |
| Small text, tables, nav | Next, weight 500, tabular figures   | 14 px / 1.45                     |
| Source                  | Mono, weights 400 and 700           | 14.5 px / 1.65                   |

The scale is Bringhurst's: 14, 17, 21, 26, 36, 44, and the display size above it. Sentence case everywhere.

### Depth

Depth is the design. There are four levels, and each has one radius and one shadow, so the hierarchy reads from the shape alone:

| Level     | What                                    | Radius | Shadow                                         |
| --------- | --------------------------------------- | ------ | ---------------------------------------------- |
| 0 table   | the background                          | none   | none                                           |
| 1 sheet   | a page, the navigation bar, a pane      | 18 px  | `0 1px 0 ink/6%, 0 12px 32px -12px ink/22%`    |
| 2 inset   | figures, source listings inside a sheet | 12 px  | none; a slightly darker vellum and a 1 px edge |
| 3 overlay | the command palette, a menu, a drawer   | 18 px  | `0 24px 64px -16px ink/38%`                    |

Controls (buttons, inputs) have an 8 px radius. Nothing else is rounded, and no two levels share a shadow. A sheet's edge is a hairline in ink at 10 %, never a white glass highlight, and there are no gradients: vellum is matte.

### Layout

```
 table ─────────────────────────────────────────────────────────────
 ╭──────────────────────────────────────────────────────────────╮   level 1, sticky
 │ schemd   Docs Playground Components Templates Labs    ⌘K  ◐  │   navigation sheet
 ╰──────────────────────────────────────────────────────────────╯
 ╭──────────────────────────────────────────────────────────────╮╮  the page sheet,
 │ Schematics from                ╭─ drawing (inset) ─────────╮ ││  with the sheet
 │ plain text                     │   ─┬─/\/\─┬──▷            │ ││  beneath peeking
 │                                │ ╭─ source vellum ───────╮ │ ││  out at the right
 │ Write one part or wire per     │ │ resistor:R1 "10 kΩ" … │ │ ││  and bottom
 │ line. schemd places, routes    │ │ R1.out -> C1.in   ▒▒▒ │ │ ││
 │ and draws it.                  │ ╰───────────────────────╯ │ ││
 │ [npm i @schemd/core] [Open]    ╰───────────────────────────╯ ││
 ╰──────────────────────────────────────────────────────────────╯│
  ╰──────────────────────────────────────────────────────────────╯
```

Content is left aligned inside its sheet. The page sheet is 1,240 px at most with 48 px of inner padding (20 px on a phone, where the sheet runs nearly edge to edge with an 8 px margin of table showing).

### Principles

1. **One bold element: the traced figure.** On the front page the source is printed on a sheet of vellum laid over its own drawing. Hovering or focusing a line marks its wire beneath with the highlighter. On load, and only then, the source sheet slides into place once.
2. **Layers mean something.** A new sheet appears only when the reader opens something (the palette, a menu, the docs contents on a phone) and slides on top of the page. The release diff is literally two sheets over each other.
3. **Yellow means checked or current.** The current page in the navigation, a traced net, a search match and text selection. Nothing else is yellow.
4. **Motion answers actions.** Sheets slide when opened, the drawing redraws when the source changes. No scroll-triggered entrances.
5. **Words name what a user does.** "Open the playground", "Copy SVG". Errors say what to change.

## Review against the generic defaults

Checked against the frontend-design skill's list:

- _Cream with a serif and a clay accent_: not used; the table is cool grey-blue and the type is a sans.
- _Near-black with one acid accent_: the Light table mode is a slate navy (#1A2230), not near-black, and its yellow is a highlighter with a single meaning.
- _Broadsheet hairlines, zero radius, dense columns_: replaced by sheets with depth and generous padding. The datasheet's ruled tables become quiet tables inside a sheet.
- _SaaS card kit_: the real risk for a layered design. Avoided by keeping sheets few and large (one page sheet, never a grid of identical cards), by giving each level its own radius and shadow, and by never chopping lists into cards. Lists stay lists and tables.
- _Glassmorphism_: frosted glass is a 2021 trend. Vellum is matte: high opacity (86 %), a light 14 px blur, no white edge highlight, no gradient, no glow.
- _Template chrome_: no all-caps eyebrows, no dot-joined meta strings, no monospace small labels (the mono is only for source), no arrows appended to links, no section numbers where the content is not a sequence.

First draft changes after this review: the first plan used a frosted white glass with a 1 px white top highlight and 40 px blur; that is the glassmorphism default, so the sheet became a matte, mostly opaque vellum. It also numbered home-page sections; they are not a sequence, so the numbers were dropped.

## Notes for later passes

- Not built yet: the release diff as two sheets laid over each other (principle 2). It still shows the two revisions side by side.

- Tried and rejected: "The Sheet" (graphite, copper, zone rulers), 2026-10-17; "Datasheet" (white, black, red, Archivo), 2026-10-25, which the owner judged distinctive but old-looking.
