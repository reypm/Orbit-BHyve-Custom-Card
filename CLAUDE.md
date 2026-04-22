# BHyve Sprinkler Card — CLAUDE.md

## Project overview

A custom Home Assistant Lovelace card for [Orbit BHyve](https://bhyve.orbitonline.com/) smart sprinkler systems. Built for the [sebr/bhyve-home-assistant](https://github.com/sebr/bhyve-home-assistant) integration.

- **Single file:** All card logic, editor, and CSS live in `bhyve-sprinkler-card.js` (one self-contained IIFE, no bundler, no NPM)
- **No dependencies:** Vanilla JS only — no external libraries, no build step
- **HACS-compatible:** Distributed via `hacs.json` as a Lovelace frontend resource

## Architecture

The entire implementation is a single IIFE in `bhyve-sprinkler-card.js` that registers two custom elements:

| Element | Purpose |
|---|---|
| `bhyve-sprinkler-card` | The card itself (main display + interactions) |
| `bhyve-sprinkler-card-editor` | The visual config editor (shown inside HA's UI editor) |

Key internal methods on the card class:

| Method | Role |
|---|---|
| `setConfig(config)` | Validates and stores config; applies defaults |
| `_render()` | Full re-render into shadow DOM |
| `_tplHeader()` | Card header HTML (title, status badge, device icon) |
| `_tplZones()` | Zone card grid HTML — hub row, programs, settings, health, footer |
| `_tplActions()` | Global action buttons (Run all, Stop all) |
| `_tplNextRun()` | Next-run footer for a zone |
| `_tplHealth()` | Battery + last-seen chips |
| `_calcNextRun()` | Card-level next run from `schedule_days` + `schedule_time` |
| `_calcZoneNextRun()` | Per-zone next run (program_entities → zone attrs → card fallback) |
| `_nextOccurrence()` | Finds the next future Date for a set of weekdays + start times |
| `_isOn(entityId)` | Returns boolean; respects `_pendingOn` / `_pendingOff` for optimistic UI |

## Development workflow

### Syntax check
```bash
node --check bhyve-sprinkler-card.js
```

### Run the test suite
```bash
node validate.test.js
```

The test suite (`validate.test.js`) is headless — it stubs browser globals (`window`, `HTMLElement`, `customElements`, `CustomEvent`) and `eval`s the card file. There are 248+ assertions across 26 test groups covering:

- Custom element registration
- `setConfig` defaults and validation
- Template rendering (idle, running, hub, programs, health, settings, actions)
- XSS escaping of user-supplied strings
- `_calcNextRun` / `_calcZoneNextRun` / `_nextOccurrence` logic
- Optimistic UI (`_pendingOn` / `_pendingOff`)
- Editor mutations (`_addZone`, `_removeZone`, `_moveZone`, `_swapZones`, `_patch`, `_patchZone`)

**Run the test suite before opening a PR. Add assertions for any logic you change.**

## Config schema

The card accepts this top-level YAML config:

```yaml
type: custom:bhyve-sprinkler-card
title: string              # default: "BHyve Sprinkler"
controller_name: string    # default: "Smart Controller"
columns: 1 | 2             # default: 2
rain_delay_entity: string  # card-level fallback
schedule_days: [0..6]      # card-level fallback (0=Sun)
schedule_time: 'HH:MM'     # card-level fallback, default: '06:00'
show_next_run: bool         # default: true
show_health: bool           # default: true
show_actions: bool          # default: true
show_hub: bool              # default: false (per-zone preferred)
zones: ZoneConfig[]
```

Per-zone fields: `entity`, `name`, `run_time`, `hub_entity`, `battery_entity`, `program_entities[]`, `smart_watering_entity`, `schedule_days`, `schedule_time`, `rain_delay_entity`, `show_sprinkler_type`, `show_programs`.

## BHyve services used

| Action | Primary service | Fallback |
|---|---|---|
| Run zone | `bhyve.start_watering` | `valve.open_valve` / `homeassistant.turn_on` |
| Stop zone | `bhyve.stop_watering` | `valve.close_valve` / `homeassistant.turn_off` |
| Enable rain delay | `bhyve.enable_rain_delay` | `homeassistant.toggle` |
| Disable rain delay | `bhyve.disable_rain_delay` | `homeassistant.toggle` |

## Key implementation notes

- **Optimistic UI:** All toggles and Run/Stop buttons update `_pendingOn` / `_pendingOff` sets immediately, then schedule a timeout to clear them. `_isOn()` checks these sets before HA state.
- **XSS safety:** All user-controlled strings (zone names, titles, friendly names) must be HTML-escaped before insertion into template strings. There are dedicated tests for this (test group 9).
- **Next-run priority:** `program_entities` (enabled only) → `program_a/b/c/e` zone switch attributes → `schedule_days` + `schedule_time`.
- **Entity domains:** Both `switch.*` and `valve.*` are supported for zone entities. `_isOn` maps `open` → true and `closed` → false for valves.
- **`ha-selector`:** The editor uses `ha-selector` (not the deprecated `ha-entity-picker`) for entity selection, setting `.selector` as a DOM property via `_initPickers()`.
- **Keyboard fix:** The editor stops `keydown` propagation to prevent HA shortcut interference.

## Files

| File | Purpose |
|---|---|
| `bhyve-sprinkler-card.js` | Entire card implementation (single IIFE) |
| `validate.test.js` | Headless test suite (Node.js, no browser) |
| `hacs.json` | HACS manifest |
| `README.md` | User-facing documentation |
| `docs/` | Preview screenshots |

## Requirements

- Home Assistant 2023.1+
- [sebr/bhyve-home-assistant](https://github.com/sebr/bhyve-home-assistant) integration
