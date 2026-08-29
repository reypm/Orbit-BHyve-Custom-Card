# Design decisions

The authoritative source for how these cards look and behave is the Claude Design
project **"BHyve Card Family"** (project `9c531b4e-77f8-4416-b3d0-450f12192eff`). The
zone card follows `BHyve Card Family v4.dc.html`; the controller card follows the v5b
states in `BHyve Card Family v5.dc.html`.

Several details in that design differ from the plain-language spec the v3 work was
briefed with. The design won in every case. This file records each one so a later
change doesn't quietly drift back toward the briefing's approximations.

**Rule: where this file and a written brief disagree, the design file wins — unless the
repo owner says otherwise in writing.**

| # | Item | The brief assumed | The design specifies | Shipped |
|---|---|---|---|---|
| 1 | **Chip height** | ~30px | **36px**, `border-radius: 19px` | 36px |
| 2 | **Card corner radius** | 16–18px | **12px** (`cardStyle` → `borderRadius: "12px"`) | `var(--ha-card-border-radius, 12px)` |
| 3 | **Healthy battery chip** | Tinted green | **Neutral fill.** `chip(icon, label, GREEN, false)` — the colour argument is ignored when `tinted` is false, so only the *low* state is tinted | Neutral |
| 4 | **Low battery colour** | Amber (`255, 193, 7`) | **Orange `255, 152, 0`** (`ORANGE`), with a `battery_alert` icon at ≤20% | `--mush-rgb-orange`, fallback `255, 152, 0` |
| 5 | **Last-run chip copy** | `"Last N min"` | **`"12 min"`** — bare duration; the `history` icon carries the "last" meaning | `"12 min"` |
| 6 | **Status indicator** | A status dot plus text | **No dot.** State is carried by the shape icon's tint plus the secondary text line | Tinted shape icon + text |
| 7 | **Accent blue** | Unspecified | **`33, 150, 243`** — which is exactly Mushroom's `--default-blue`. (v2 used `3, 169, 244`, Mushroom's `--default-light-blue`) | `--mush-rgb-blue`, fallback `33, 150, 243` |
| 8 | **Controller "Off" state** | Not in the status list | **An orange banner:** "Controller is off — no program will run.", orange shape icon, and the `Off` segment filled | Implemented |

---

## v5b — the controller summary moves into the drawer

The controller card's summary chip row (hub, battery, next run, weekly volume) repeated
the same device-level facts on every controller card on a dashboard, and duplicated hub
status against the v4 zone-card work. The design project offered two answers and the repo
owner picked **v5b**: no chip row at all, the stats as read-only rows inside the drawer,
and hub status as a dot on the header icon. The v5a alternative — a regrouped chip row —
was **not** selected; do not reintroduce it, and do not ship both. Putting the same four
facts on screen twice is the thing v5 exists to stop.

| # | Item | The obvious move | The design specifies | Shipped |
|---|---|---|---|---|
| 9 | **Removing the hub chip** | Delete it; the drawer has a Hub row now | **Neither a flat removal nor a badge.** A flat removal would put hub status behind a tap, breaking the v3 rule that an offline hub is never hidden. A badge still spends dedicated space to say "nothing is wrong". Instead hub status becomes a property of the thing it describes: a **12 px dot** on the header's 40 px device icon, offset `right`/`bottom: -1px`, ringed 2 px in the card background | `.hub-dot`, green online / red offline, rendered in both drawer states |
| 10 | **Which stats get an indicator** | One per stat | **Only hub.** Battery, next run and weekly volume move into the drawer with no above-the-fold trace — none of them is ever the explanation for something else looking wrong. The moment there are two dots, neither reads as a status light | One dot, bound to `binary_sensor.*_connected` |
| 11 | **Where the Status section goes** | Wherever it fits | **First, above Programs.** It preserves the card's reading order — the stats used to sit just above the drawer handle — and separates by interactivity: read-only rows, divider, then everything you can act on | `Status · all zones` → `hr` → `Programs · all zones` → rain delay → run time |
| 12 | **Making read-only obvious** | Leave the right edge empty, or show a disabled switch | **A plain right-aligned value.** Four rows with nothing where their neighbours have switches read as controls that failed to load; a value in that column reads unmistakably as data. 14 px / 500, tabular numerals, no fill, no border, no chevron, no hover | `.stat-val` |
| 13 | **Colour in the section** | Tint the values | **Hub only, and on its icon circle, not its value.** It is the one row that carries colour, for the same reason its chip did | Green/red shape on the Hub row; every value in `--primary-text-color` |

### What was scoped out of this round

- **The offline escalation** — the design's `v5b · Hub offline` state pairs the red dot
  with a `Hub offline` secondary line and a red banner that outranks the controller-off
  banner. Only the dot's red state ships. The controller card never carried a hub chip to
  begin with, so nothing was lost relative to v4, but the louder offline treatment is
  still on the table.
- **The v5 zone-card changes** — `show_hub_status: offline_only|always|never`,
  `show_battery: low_only|always|never`, and the suppression/per-zone chip split. The zone
  card is untouched at v4.

### Where the implementation extends the design

The design's Next run sub-line, "Earliest across all zones · Front Lawn", does not fit on
one line in a 380 px card. Rather than drop the zone name — the entire reason the sub-line
exists — status-row sub-lines wrap to a second line. They have no control on the right to
collide with, so nothing else moves.

The design's Battery sub-line reads "Controller · discharging". The integration exposes a
battery *level* and nothing else; there is no charging state to report, so the sub-line
ships as just "Controller" rather than asserting something no entity backs. Likewise the
Hub sub-line's "· −58 dBm" half is appended only when a signal-strength entity actually
resolves, and omitted cleanly when none does.

---

## Note on the Mushroom colour tokens

This trips people up, so it is worth writing down.

Mushroom **never sets** `--mush-rgb-*`. Those variables exist purely as a theme override
hook. `src/utils/theme.ts` reads them:

```css
--rgb-blue: var(--mush-rgb-blue, var(--default-blue));
```

and it does so on `:host` of Mushroom's **own** elements, so `--rgb-*` and `--default-*`
are scoped to Mushroom's shadow roots and are not visible to this card.

Two consequences:

1. **The fallback values in `RGB` are the operative palette** for most installs. They are
   deliberately identical to Mushroom's `--default-*` values, so the cards match Mushroom
   out of the box. Do not "simplify" them away.
2. **`--mush-rgb-*` still works as an override.** A theme that sets it at document level
   is inherited by these cards and repaints the accent throughout — verified in
   `tools/harness.html?mush=teal`.
3. **Do not use `--mush-rgb-*` as a probe for "is Mushroom installed".** It is unset on a
   normal Mushroom install. See the open item in the branch report.

Mushroom's default palette, for reference:

```
red 244,67,54   purple 146,107,199   blue 33,150,243   light-blue 3,169,244
green 76,175,80   amber 255,193,7   orange 255,152,0   grey 158,158,158
```

---

## 9. The Mushroom detection probe — removed, not fixed

**What it did.** Early v3 probed
`getComputedStyle(document.documentElement).getPropertyValue('--mush-rgb-blue')` at render
time and, when it came back empty, showed a dismissible banner reading "Mushroom is not
installed. These cards render, but with degraded colours."

**Why it was wrong.** `--mush-rgb-*` is an override hook that Mushroom only ever *reads* —
see the note above. On a completely normal Mushroom install nothing sets it, so the probe
came back empty and the banner fired for virtually every user, including those with
Mushroom correctly installed. Both of its claims were false: Mushroom was usually present,
and the colours were not degraded.

**Why it was removed rather than corrected.** A correct probe is possible — mount a
throwaway Mushroom element and read `--rgb-blue` off its shadow root — but it would be
detecting something that no longer matters. The fallbacks are byte-identical to Mushroom's
`--default-*` palette, so a card without Mushroom renders exactly as intended. There is
nothing left for the warning to warn about, and a probe that exists only to render a
no-op notice is pure liability.

**Do not re-add one.** If a future change makes the cards genuinely depend on something
Mushroom provides, state that dependency in the README and fail visibly at the point of
use — do not reintroduce a global "is Mushroom installed?" heuristic. `--mush-rgb-*` in
particular can never answer that question.

---

## 10. Controller status text is pluralised — an approved deviation

This is the one entry here where the shipped behaviour intentionally differs **from** the
design file rather than deferring to it. It is approved, in writing, by the repo owner.

**What the design file says.** `BHyve Card Family v3.dc.html` builds the controller's
secondary line as:

```js
runningIds.length ? "B‑hyve XR · " + runningIds.length + " zone watering" : …
```

The noun is unpluralised in both branches, so with two zones running the mockup literally
reads "B-hyve XR · 2 zone watering".

**What ships.** The count is pluralised:

- one zone running → `1 zone watering`
- more than one → `N zones watering`

**Why this is deliberate.** The design canvas renders a single sample state at a time, so
its copy was only ever exercised with one running zone — the string is correct in the case
the mockup shows and simply was never varied. A static mockup does not make grammar
decisions for every value of N. Shipping "2 zone watering" in a real dashboard would read
as a bug to users, and it would be inconsistent with the card's own surrounding copy, which
is otherwise grammatical ("All idle", "Rain delay active", "Fault detected").

**Do not "fix" this back.** A future contributor diffing the implementation against the
design file will find this discrepancy and may be tempted to restore the literal
unpluralised string to match. Do not. If the design file is ever regenerated with a
multi-zone sample state, it should adopt the plural, not the other way round.
