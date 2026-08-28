# Design decisions

The authoritative source for how these cards look and behave is the Claude Design
project **"BHyve Card Family v3"** (`BHyve Card Family v3.dc.html`, project
`9c531b4e-77f8-4416-b3d0-450f12192eff`).

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
