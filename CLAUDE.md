# B-hyve Cards — CLAUDE.md

## Project overview

Two custom Home Assistant Lovelace cards for [Orbit B-hyve](https://bhyve.orbitonline.com/)
irrigation, built for the [sebr/bhyve-home-assistant](https://github.com/sebr/bhyve-home-assistant)
integration.

- **Single file:** both cards, both editors, and all shared logic live in
  `bhyve-cards.js` (one self-contained IIFE, no bundler, no NPM)
- **No dependencies at build time; Mushroom is a runtime style dependency**
- **HACS-compatible:** distributed via `hacs.json` as one Lovelace frontend resource

v3.0.0 replaced the single all-in-one `bhyve-sprinkler-card` (see the `v2.0.0` tag).

## Architecture

`bhyve-cards.js` registers four custom elements:

| Element | Purpose |
|---|---|
| `bhyve-controller-card` | One per B-hyve device: status, Auto/Off, hub dot, zone rows, settings drawer |
| `bhyve-zone-card` | One per zone: four states, fixed chip row, inline rows. Also renders flood sensors |
| `bhyve-controller-card-editor` | `ha-form` editor for the controller card |
| `bhyve-zone-card-editor` | `ha-form` editor for the zone card |

### Shared layer

Module-level helpers, used by both cards:

| Name | Role |
|---|---|
| `RGB` / `ICON` | Design tokens mapped onto `--mush-rgb-*`; MDI icon names |
| `esc`, `num`, `fmtClock`, `fmtDuration`, `fmtTime`, `relativeFuture`, `fmtSince` | Formatting |
| `chipHtml`, `shapeHtml`, `swHtml` | Markup primitives matching the design vocabulary |
| `loadRegistry` | Cached `config/entity_registry/list` + `config/device_registry/list`, filtered to `platform === 'bhyve'` |
| `pickForZone` | Resolves one related entity for a zone — see the note below |
| `resolveZone` / `resolveDevice` | Turn one entity into the full related-entity set |
| `programSummary`, `programName`, `programIcon`, `faultText`, `rainDelayHours` | Attribute readers |
| `BhyveBase` | Shared element base: hass setter, optimistic state, service wrappers, tick timer, Mushroom notice |

**`pickForZone` is subtle.** A name match wins. Failing that, a lone candidate is treated
as a device-level entity shared by all zones (fault, rain delay, device mode). That
assumption is wrong for per-zone entities — hub, battery, history, smart watering — on a
multi-zone device, so those pass `perZone: true` and require the match unless the device
has only one zone. Without this a zone with no sensor of its own silently borrows a
sibling zone's reading.

## Development workflow

```bash
node --check bhyve-cards.js
node validate.test.js
```

`validate.test.js` is headless: it stubs browser globals, `eval`s the card file, then
mounts both cards against a fake device/entity registry. The DOM stub parses rendered
tags, so tests dispatch real clicks at handles and exercise the actual event handlers.
434 assertions across 30 groups cover the zone card's four states, chip order and each
chip's visibility rule, the drawer toggle, the run-time stepper's fallback, the merged
programs list with per-zone run times, station-order zone sorting, the device-Off state,
omitted quick-action buttons, service-call payloads, flood sensors, the empty state, the
controller's hub dot and read-only Status section with its weekly-volume aggregation, and
XSS escaping.

**Run the test suite before opening a PR. Add assertions for any logic you change.**

When asserting on rendered markup, strip the inline `<style>` block first (the tests'
`body()` helper) — otherwise a class-name substring check matches the stylesheet.

## Key implementation notes

- **Design source of truth:** the "BHyve Card Family" Claude Design project. The chip
  order, the four zone states, copy strings and colour treatments come from there. The
  zone card tracks the v4 states; the controller card tracks **v5b** — the alternative
  labelled v5a in the same file was rejected and must not be shipped alongside it.
- **The controller card has no summary chip row.** Hub, battery, next run and weekly
  volume are read-only rows in the drawer's `Status · all zones` section, which sits above
  `Programs · all zones` and is separated from it by a divider: read-only first, then
  everything you can act on. The rows carry a right-aligned `.stat-val` and never a
  switch — an empty right column reads as controls that failed to load. Hub status is the
  one fact that stays visible with the drawer closed, as a 12 px `.hub-dot` on the header
  shape icon. Do not add a second dot for any other stat.
- **`show_actions` and `show_programs` gate the drawer's controls block only.** They
  never gate the Status section, which `_drawer()` renders on its own path — device
  health is not a control, and hiding the programs list used to take it down with it.
  The toggle row renders when either part has content, so Status stays one tap away
  rather than always on screen; with the controls hidden its label becomes `Show status`.
  Only an option written specifically for Status could hide it, and there is none.
- **`weekly_volume_entity` on the controller card takes a string or a list.** A string is
  one device-level helper and is labelled "All zones combined". A list is summed, skipping
  helpers that do not report, and is labelled `N of M zones` when it covers fewer than the
  card's zones — a partial total must never present itself as the whole.
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
  Tracked upstream: https://github.com/sebr/bhyve-home-assistant/issues/478 — if that lands,
  the stepper could gain real confirmation and this constraint can be revisited.
- **Programs are a single-selection group.** B-hyve hardware runs one program at a time, so
  `_selectProgram()` issues `switch.turn_on` for the tapped entity and `switch.turn_off` for
  the outgoing one in the same handler, setting optimistic state for both before either call
  is dispatched. Smart watering is deliberately outside this group and keeps its own
  `_toggle()` path. The zone card's v3 `show_programs` was retired in v4 and deliberately not
  reused: `show_smart_watering_and_programs` hides the whole section, while the fold inside
  a shown section is not configurable. The controller card's `show_programs` is unrelated
  and still live. Every boolean option in this codebase is `show_*`, positive polarity,
  default true, read via `!== false` — keep it that way.
- **Optimistic UI:** `_pendingOn` / `_pendingOff` sets, cleared when HA confirms or on a
  timeout. `_isOn()` checks them before HA state; `open` → true for valves.
- **Live countdown:** recomputed from `started_watering_station_at` plus the run minutes,
  on a 1s tick that only runs while a zone is watering.
- **XSS safety:** every user-controlled string goes through `esc()` before interpolation.
  Test group 21 covers it.
- **Mushroom is a soft dependency, deliberately undetected.** Every `RGB` fallback equals
  Mushroom's own `--default-*` value, so the cards look right with or without it, and pick
  up a theme's `--mush-rgb-*` overrides when they exist. There is no detection probe — see
  DESIGN_DECISIONS.md for why one must not be re-added.
- **Dark theme:** neutral surfaces use `color-mix` against `--primary-text-color`, which
  inverts with the theme, so chips never collapse to grey-on-grey.

## Files

| File | Purpose |
|---|---|
| `bhyve-cards.js` | Both cards, both editors, shared layer (single IIFE) |
| `validate.test.js` | Headless test suite (Node.js, no browser) |
| `hacs.json` | HACS manifest |
| `README.md` | User-facing documentation |
| `docs/` | Preview screenshots (regenerated from `tools/harness.html`) |
| `tools/harness.html` | Browser render harness for both cards (mocked hass) |
| `DESIGN_DECISIONS.md` | Where the design file overrode the written brief, and why |

## Requirements

- Home Assistant 2023.1+
- [sebr/bhyve-home-assistant](https://github.com/sebr/bhyve-home-assistant)
- [Mushroom](https://github.com/piitaya/lovelace-mushroom) for the intended styling
