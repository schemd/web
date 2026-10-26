# Design: the datasheet

schemd's website reads like the datasheet of a part. A datasheet is the document engineers already trust to tell them, plainly and completely, what a part accepts and what it does. schemd's 114 component kinds are parts in that sense, and since core 1.3 each kind describes itself as data, so the site can print a real datasheet for every one.

## Subject, audience, job

- **Subject:** a compiler that turns lines of text into schematic drawings (electrical, digital, quantum, UML).
- **Audience:** engineers writing documentation, educators and students, and technical writers who already work in Markdown.
- **Primary job:** show that a line of text becomes a clean drawing, let a visitor try it at once, and answer exactly what each part accepts.

## Tokens

### Colour

| Token                  | Paper (default) | Negative  | Use                                                |
| ---------------------- | --------------- | --------- | -------------------------------------------------- |
| `--bg` paper           | `#FFFFFF`       | `#000000` | the page                                           |
| `--ink`                | `#000000`       | `#FFFFFF` | text, the header rule                              |
| `--ink-mute`           | `#4A4F57`       | `#B4BAC2` | secondary text, captions                           |
| `--line` rule          | `#C9CED5`       | `#3A3F46` | table rules, figure frames                         |
| `--wash` figure ground | `#EEF2F6`       | `#14181D` | behind figures and source listings                 |
| `--accent` change red  | `#C4161C`       | `#FF5C61` | links, the current page, change bars; nothing else |

Pure white and pure black, never cream and never a tinted near-black. Red is the only colour the interface itself uses; the drawings keep schemd's own net colours.

### Type

One family, Archivo, used across its width axis, plus Commit Mono for source.

| Role                         | Face                                             | Size / leading                            |
| ---------------------------- | ------------------------------------------------ | ----------------------------------------- |
| Wordmark in the header band  | Archivo, width 125, weight 800                   | 30 px                                     |
| Page title                   | Archivo, width 75, weight 700                    | 48 px / 1.05                              |
| Section heading              | Archivo, width 75, weight 700                    | 26 px / 1.15                              |
| Body                         | Archivo, width 100, weight 400                   | 17 px / 1.55, measure under 72 characters |
| Tables, captions, navigation | Archivo, width 87.5, weight 500, tabular figures | 14 px / 1.4                               |
| Source                       | Commit Mono 400 and 700                          | 14.5 px / 1.6                             |

The scale follows Bringhurst's classic sequence: 13, 14, 17, 21, 26, 36, 48. Sentence case everywhere. No all-caps labels, no tracking-out.

### Layout

```
┌────────────────────────────────────────────────────────────┐
│ schemd   Text-to-schematic compiler      Revision 1.3.0    │  header band
│                                           October 2026  EN │
├━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┤  4 px ink rule
│ Docs  Playground  Components  Labs  Examples  Changelog    │  navigation
├────────────────┬───────────────────────────────────────────┤
│ Features       │ Description                               │  front page:
│ - ...          │ prose ...                                 │  two columns
│ - ...          │ ┌───────────────────────────────────────┐ │
│                │ │ live figure on the wash               │ │
│                │ └───────────────────────────────────────┘ │
│                │ Figure 1. RTD signal chain                │
└────────────────┴───────────────────────────────────────────┘
```

Everything is left aligned with a ragged right. A 12-column grid, 1,200 px at most. Figures sit on the wash with their caption below ("Figure 3. ..."), tables carry their caption above ("Table 2. ..."), and both are numbered in page order because they really are a sequence.

### Principles

1. **The content is the specification.** Numbers on the page come from the compiler, the schema or the release record. No decorative statistics.
2. **Structure encodes meaning.** A red bar in the margin marks content changed in the current revision, as a datasheet's change bars do. Figure and table numbers give page order. Red means "link" or "changed", and nothing else.
3. **One bold element.** The header band with its extended wordmark. Everything below it is quiet.
4. **Motion answers actions.** The playground redraws when the source changes, and panels open when asked. Nothing fades in on scroll.
5. **Words name what a user does.** "Open in playground", "Copy SVG". Errors say what to change.

## Review against the generic defaults

Checked against the frontend-design skill's list of generated-page tells:

- _Cream ground with a serif and a clay accent_: not used; the paper is pure white and the accent is crimson.
- _Near-black with one acid accent_: the old "Sheet" design was close to this. The Negative mode is pure black with the same restrained red, and it is optional.
- _Broadsheet hairlines, zero radius, dense columns_: the real risk for a datasheet. Rules appear only where they form a table or the header rule; controls keep a 3 px radius; the front page has two generous columns, not newspaper columns.
- _SaaS card kit_: no card grids. Lists of things are tables or plain lists.
- _Template chrome_: no all-caps eyebrows, no dot-joined meta strings, no monospace for small labels (tables use Archivo's tabular figures), no arrows appended to links.

The sketch shown during approval had an all-caps header and a dot-joined revision line; both were dropped for the build.

## Notes for later passes

- Tried and rejected: "The Sheet" (graphite, copper, zone rulers, Martian Mono annotations), 2026-10-17.
