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
