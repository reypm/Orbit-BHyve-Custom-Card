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
| `bhyve-controller-card` | One per B-hyve device: status, Auto/Off, zone rows, settings drawer |
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
168 assertions across 24 groups cover the zone card's four states, chip order and each
chip's visibility rule, the drawer toggle, the run-time stepper's fallback, the merged
programs list with per-zone run times, station-order zone sorting, the device-Off state,
omitted quick-action buttons, service-call payloads, flood sensors, the empty state, and
XSS escaping.

**Run the test suite before opening a PR. Add assertions for any logic you change.**

When asserting on rendered markup, strip the inline `<style>` block first (the tests'
`body()` helper) — otherwise a class-name substring check matches the stylesheet.

## Key implementation notes

- **Design source of truth:** the "BHyve Card Family v3" Claude Design project. The chip
  order, the four zone states, copy strings and colour treatments come from there.
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
