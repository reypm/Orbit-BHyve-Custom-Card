# B-hyve Card — repository guide

## Project overview

One custom Home Assistant Lovelace card for [Orbit B-hyve](https://bhyve.orbitonline.com/)
irrigation, built for the [sebr/bhyve-home-assistant](https://github.com/sebr/bhyve-home-assistant)
integration.

- **Single file:** the card, its editor and all shared logic live in `bhyve-cards.js`
  (one self-contained IIFE, no bundler, no NPM). The filename is plural for historical
  reasons — v3–v4 shipped two card types from it — and is kept so existing HACS installs
  and Lovelace resource registrations keep working.
- **No dependencies at build time; Mushroom is a runtime style dependency**
- **HACS-compatible:** distributed via `hacs.json` as one Lovelace frontend resource

v5.0.0 merged the v3–v4 pair (`bhyve-controller-card` + `bhyve-zone-card`) into one card.
v3.0.0 had split the original all-in-one `bhyve-sprinkler-card` (see the `v2.0.0` tag).

## Architecture

`bhyve-cards.js` registers three custom elements:

| Element | Purpose |
|---|---|
| `bhyve-card` | The card: one per B-hyve device. Also renders flood sensors |
| `bhyve-card-editor` | `ha-form` editor for it |
| `bhyve-controller-card` | Bare subclass of `BhyveCard`, registered under the v4 name so v4 dashboards keep rendering. Deliberately absent from `window.customCards` |

`bhyve-zone-card` is gone. Do not resurrect it — the whole point of v5 is that a fact
shared by every zone under a controller is shown once.

### Shared layer

| Name | Role |
|---|---|
| `RGB` / `ICON` | Design tokens mapped onto `--mush-rgb-*`; MDI icon names |
| `esc`, `num`, `fmtClock`, `fmtDuration`, `fmtTime`, `relativeFuture` | Formatting |
| `chipHtml`, `shapeHtml`, `swHtml` | Markup primitives matching the design vocabulary |
| `loadRegistry` | Cached `config/entity_registry/list` + `config/device_registry/list`, filtered to `platform === 'bhyve'` |
| `pickSibling` | Resolves one entity registered to the same device as another — only the flood layout needs it |
| `resolveDevice` | Turns one device id into the full related-entity set |
| `programSummary`, `programName`, `programIcon`, `faultText`, `rainDelayHours` | Attribute readers |
| `BhyveBase` | The card's base: hass setter, optimistic state, service wrappers, tick timer |

## Development workflow

```bash
node --check bhyve-cards.js
node validate.test.js
```

`validate.test.js` is headless: it stubs browser globals, `eval`s the card file, then
mounts the card against a fake device/entity registry. The DOM stub parses rendered tags,
so tests dispatch real clicks at handles and exercise the actual event handlers.
207 assertions across 21 groups cover the header and zone rows, the hub dot, the two
accordions and their independence, the read-only Status section and its four rows, the
weekly-volume aggregation, the merged programs list with its disabled subsection, the
run-time stepper, both `show_*` options, the `zones` config forms, flood sensors, the
empty state, the legacy alias, and XSS escaping.

**Run the test suite before opening a PR. Add assertions for any logic you change.**

When asserting on rendered markup, strip the inline `<style>` block first (the tests'
`body()` helper) — otherwise a class-name substring check matches the stylesheet.

## Key implementation notes

- **Design source of truth:** the "BHyve Card Family" design-system project, file
  `BHyve Card Family v5.dc.html`, **v5b** states. The alternative labelled v5a in the same
  file — a reordered top-level chip row — was rejected and must not be shipped.
- **The card has no chip row.** Hub, battery, next run and weekly volume are read-only
  rows in the settings section's `Status · all zones` block, above a divider, then rain
  delay and run time. The rows carry a right-aligned `.stat-val` and never a switch — an
  empty right column reads as controls that failed to load.
- **Hub status is a 12px `.hub-dot`** on the header shape icon, green online / red
  offline. It is the only ambient indicator on the card and no config option can hide it.
  Do not add a second dot for any other stat.
- **Two accordions, not one drawer.** `_open = { settings, programs }`, independent, both
  closed by default. `show_actions` gates every control (Run/Stop, rain delay, run time
  and the whole programs section); `show_programs` gates the programs section alone.
  Neither reaches the Status rows: device health is not a control.
- **Programs are independent switches** on this card — one `switch.turn_on`/`turn_off` per
  tap, no single-selection pairing. The v4 zone card's single-selection group went with
  the zone card. Disabled programs are a **subsection**, not a fold.
- **`manual_preset_runtime` is in SECONDS.** The integration's source field is
  `manual_preset_runtime_sec` and it divides by 60 itself before watering, but both
  `bhyve.start_watering` and `bhyve.set_manual_preset_runtime` take MINUTES. Every read
  goes through `_presetRuntimeMinutes()` so that asymmetry is handled once — never read
  the attribute directly. Reading it raw shipped a bug that displayed "Run 300 min" and
  would have watered for five hours.
- **A successful preset write is not observable.** The valve entity assigns
  `_manual_preset_runtime` in its constructor and has no coordinator-update hook, so the
  attribute cannot change during a session. Do not add a "did the attribute change?"
  confirmation to the run-time stepper — it would report failure on every success.
  Tracked upstream: https://github.com/sebr/bhyve-home-assistant/issues/478
- **`weekly_volume_entity` takes a string or a list.** A string is one device-level helper,
  labelled "All zones combined". A list is summed, skipping helpers that do not report, and
  labelled `N of M zones` when it covers fewer than the card's zones — a partial total must
  never present itself as the whole.
- **`zones` takes entity ids or `{ entity, name }`.** The object form carries a per-zone
  display name, the one per-zone setting v5b still renders.
- **Optimistic UI:** `_pendingOn` / `_pendingOff` sets, cleared when HA confirms or on a
  timeout. `_isOn()` checks them before HA state; `open` → true for valves.
- **Live countdown:** recomputed from `started_watering_station_at` plus the run minutes,
  on a 1s tick that only runs while a zone is watering.
- **XSS safety:** every user-controlled string goes through `esc()` before interpolation,
  including configured zone-name overrides. Test group 19 covers it.
- **Mushroom is a soft dependency, deliberately undetected.** Every `RGB` fallback equals
  Mushroom's own `--default-*` value, so the card looks right with or without it, and picks
  up a theme's `--mush-rgb-*` overrides when they exist. There is no detection probe — see
  DESIGN_DECISIONS.md for why one must not be re-added.
- **Dark theme:** neutral surfaces use `color-mix` against `--primary-text-color`, which
  inverts with the theme, so chips never collapse to grey-on-grey.

## Files

| File | Purpose |
|---|---|
| `bhyve-cards.js` | The card, its editor, the shared layer (single IIFE) |
| `validate.test.js` | Headless test suite (Node.js, no browser) |
| `hacs.json` | HACS manifest |
| `README.md` | User-facing documentation |
| `docs/` | Preview screenshots — always regenerated from `tools/harness.html`, never exported from the design canvas |
| `tools/harness.html` | Browser render harness (mocked hass), with `compose=<recipe>` for each README image |
| `DESIGN_DECISIONS.md` | Where the design file overrode the written brief, and why |

## Requirements

- Home Assistant 2023.1+
- [sebr/bhyve-home-assistant](https://github.com/sebr/bhyve-home-assistant)
- [Mushroom](https://github.com/piitaya/lovelace-mushroom) for the intended styling
