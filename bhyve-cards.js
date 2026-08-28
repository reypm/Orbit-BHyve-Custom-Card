// =============================================================================
// B-hyve Cards for Home Assistant — v3.0.0
//   custom:bhyve-controller-card  — one per B-hyve device
//   custom:bhyve-zone-card        — one per zone / flood sensor
//
// Both card types live in this one file so HACS ships a single JS resource and
// Lovelace has no resource-ordering problem. See README "Why one file".
//
// Design source: "BHyve Card Family v3" (Claude Design project 9c531b4e).
// Integration:   https://github.com/sebr/bhyve-home-assistant
// Repository:    https://github.com/reypm/Orbit-BHyve-Custom-Card
// =============================================================================

(function () {
  'use strict';

  const CARD_VERSION   = '3.2.0';
  const CONTROLLER     = 'bhyve-controller-card';
  const ZONE           = 'bhyve-zone-card';
  const CONTROLLER_ED  = 'bhyve-controller-card-editor';
  const ZONE_ED        = 'bhyve-zone-card-editor';

  // ---------------------------------------------------------------------------
  // Design tokens
  //
  // The design file uses literal RGB triplets; each maps onto the Mushroom
  // custom property of the same hue, with the design value as the fallback so
  // the cards still look right when Mushroom is missing.
  // ---------------------------------------------------------------------------
  const RGB = {
    accent: 'var(--mush-rgb-blue, 33, 150, 243)',
    green:  'var(--mush-rgb-green, 76, 175, 80)',
    orange: 'var(--mush-rgb-orange, 255, 152, 0)',
    red:    'var(--mush-rgb-red, 244, 67, 54)',
    purple: 'var(--mush-rgb-purple, 146, 107, 199)',
    grey:   'var(--mush-rgb-grey, 158, 158, 158)',
  };

  const ICON = {
    controller: 'mdi:sprinkler-variant',
    zone:       'mdi:sprinkler',
    flood:      'mdi:home-flood',
    unknown:    'mdi:help-circle-outline',
    warn:       'mdi:alert',
    tune:       'mdi:tune',
    down:       'mdi:chevron-down',
    up:         'mdi:chevron-up',
    rain:       'mdi:weather-rainy',
    timer:      'mdi:timer-outline',
    smart:      'mdi:brain',
    calendar:   'mdi:calendar-month',
    minus:      'mdi:minus',
    plus:       'mdi:plus',
    play:       'mdi:play',
    stop:       'mdi:stop',
    blocked:    'mdi:cancel',
    wifi:       'mdi:wifi',
    wifiOff:    'mdi:wifi-off',
    battery:    'mdi:battery',
    batteryLow: 'mdi:battery-alert',
    history:    'mdi:history',
    drop:       'mdi:water',
    chart:      'mdi:chart-bar',
    clock:      'mdi:clock-outline',
    thermo:     'mdi:thermometer',
  };

  // ---------------------------------------------------------------------------
  // Shared CSS
  //
  // Surface fills (--bh-shape / --bh-chip / --bh-track / --bh-divider) are
  // derived from --primary-text-color with color-mix rather than hard-coded per
  // theme: the text colour is dark on a light theme and light on a dark one, so
  // one declaration yields the design's rgba(33,33,33,.06) in light and a white
  // overlay in dark. That is what keeps neutral chips off grey-on-grey in dark
  // mode without the card having to detect the theme.
  // ---------------------------------------------------------------------------
  const BASE_STYLES = `
    :host { display: block; }
    * { box-sizing: border-box; }

    ha-card {
      --bh-shape:   rgba(158,158,158,.14);
      --bh-chip:    rgba(158,158,158,.16);
      --bh-track:   rgba(158,158,158,.22);
      --bh-divider: rgba(158,158,158,.22);
      --bh-shape:   color-mix(in srgb, var(--primary-text-color) 6%,  transparent);
      --bh-chip:    color-mix(in srgb, var(--primary-text-color) 10%, transparent);
      --bh-track:   color-mix(in srgb, var(--primary-text-color) 12%, transparent);
      --bh-divider: color-mix(in srgb, var(--primary-text-color) 12%, transparent);
      border-radius: var(--ha-card-border-radius, 12px);
      overflow: hidden;
      /* Lets the rules below react to the card's own width rather than the
         viewport's, since a card can be narrow on a wide screen. */
      container-type: inline-size;
      font-family: var(--mush-font-family, var(--primary-font-family, sans-serif));
    }
    ha-card.accent-red { box-shadow: 0 0 0 1px rgba(${RGB.red}, .45); }

    .row { display: flex; align-items: center; gap: 10px; padding: 10px; }
    .grow { flex: 1; min-width: 0; }
    .primary {
      font-size: 14px; font-weight: 500; line-height: 20px; letter-spacing: .1px;
      color: var(--primary-text-color);
      white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
    }
    .primary.muted { color: var(--secondary-text-color); }
    .secondary {
      font-size: 12px; line-height: 16px; color: var(--secondary-text-color);
      white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
    }

    /* ── Shape icon ──────────────────────────────────────────────────── */
    .shape {
      width: 36px; height: 36px; border-radius: 50%; flex: 0 0 auto;
      display: flex; align-items: center; justify-content: center;
      transition: background-color 280ms ease-out;
    }
    .shape ha-icon { --mdc-icon-size: 22px; transition: color 280ms ease-in-out; }
    .shape.lg { width: 40px; height: 40px; }
    .shape.lg ha-icon { --mdc-icon-size: 24px; }
    .shape.xl { width: 48px; height: 48px; }
    .shape.xl ha-icon { --mdc-icon-size: 28px; }

    /* ── Chips ───────────────────────────────────────────────────────── */
    .chips { display: flex; flex-wrap: wrap; gap: 8px; padding: 10px; }
    .chip {
      display: flex; align-items: center; gap: 6px; flex: 0 0 auto;
      height: 36px; padding: 0 12px; border-radius: 19px;
      background: var(--bh-chip); color: var(--primary-text-color);
      font-size: 13px; font-weight: 500; letter-spacing: .1px;
    }
    .chip ha-icon { --mdc-icon-size: 18px; color: var(--secondary-text-color); }

    /* ── Buttons ─────────────────────────────────────────────────────── */
    button {
      font: inherit; cursor: pointer; border: 0; background: none;
      color: inherit; padding: 0; -webkit-tap-highlight-color: transparent;
    }
    button:focus-visible { outline: 2px solid rgb(${RGB.accent}); outline-offset: 2px; }

    .btn {
      display: flex; align-items: center; justify-content: center; gap: 8px;
      height: 42px; border-radius: 12px; font-size: 14px; font-weight: 500;
      background: rgba(${RGB.accent}, .22); color: rgb(${RGB.accent});
      transition: background-color 180ms;
    }
    .btn.stop { background: rgba(${RGB.red}, .22); color: rgb(${RGB.red}); }
    .btn.blocked {
      background: var(--bh-shape); color: var(--secondary-text-color);
      cursor: not-allowed;
    }
    .btn ha-icon { --mdc-icon-size: 22px; }

    .icon-btn {
      display: flex; align-items: center; justify-content: center;
      width: 42px; height: 42px; border-radius: 12px; flex: 0 0 auto;
      border: 1px solid var(--bh-divider); background: transparent;
      color: var(--secondary-text-color); transition: background-color 180ms;
    }
    .icon-btn ha-icon { --mdc-icon-size: 22px; }
    .icon-btn.on { border-color: transparent; }
    .icon-btn.on.accent { background: rgba(${RGB.accent}, .22); color: rgb(${RGB.accent}); }
    .icon-btn.on.purple { background: rgba(${RGB.purple}, .22); color: rgb(${RGB.purple}); }

    /* ── Toggle switch ───────────────────────────────────────────────── */
    .sw {
      width: 42px; height: 26px; flex: 0 0 auto; border-radius: 13px; padding: 3px;
      display: flex; align-items: center; justify-content: flex-start;
      background: var(--bh-track); transition: background-color 180ms ease-out;
    }
    .sw.on { justify-content: flex-end; background: rgb(${RGB.accent}); }
    .sw.on.purple { background: rgb(${RGB.purple}); }
    .sw-knob {
      width: 20px; height: 20px; border-radius: 50%; display: block;
      background: var(--secondary-text-color); box-shadow: 0 1px 2px rgba(0,0,0,.25);
    }
    .sw.on .sw-knob { background: #fff; }

    /* ── Progress bar ────────────────────────────────────────────────── */
    .bar { height: 4px; background: var(--bh-track); }
    .bar > div {
      height: 100%; background: rgb(${RGB.accent}); transition: width 1s linear;
    }

    /* ── Inline banners ──────────────────────────────────────────────── */
    .banner {
      display: flex; align-items: center; gap: 10px;
      margin: 0 10px 10px; padding: 10px 12px; border-radius: 12px;
      font-size: 13px; line-height: 1.35;
    }
    .banner ha-icon { --mdc-icon-size: 20px; flex: 0 0 auto; }
    .banner.red    { background: rgba(${RGB.red}, .14);    color: rgb(${RGB.red}); }
    .banner.orange { background: rgba(${RGB.orange}, .16); color: rgb(${RGB.orange}); }

    /* ── Empty state ─────────────────────────────────────────────────── */
    .empty {
      display: flex; flex-direction: column; align-items: center; text-align: center;
      gap: 10px; padding: 28px 20px;
    }
    .empty .sub {
      font-size: 12px; line-height: 17px; color: var(--secondary-text-color);
      margin-top: 2px; max-width: 30ch;
    }
  `;

  const CONTROLLER_STYLES = `
    .seg {
      display: flex; background: var(--bh-shape); border-radius: 12px;
      padding: 3px; flex: 0 0 auto;
    }
    .seg button {
      height: 30px; padding: 0 14px; border-radius: 9px;
      font-size: 13px; font-weight: 500; letter-spacing: .1px;
      color: var(--secondary-text-color); background: transparent;
      transition: background-color 180ms;
    }
    .seg button.on { background: rgb(${RGB.accent}); color: #fff; }

    .zone-rows { display: flex; flex-direction: column; gap: 8px; padding: 0 10px 10px; }
    .zone-row { border-radius: 12px; background: var(--bh-shape); overflow: hidden; }
    .zone-row .row { padding: 8px 10px; }
    .zone-row .name { cursor: pointer; }
    .zone-row .btn { padding: 0 14px; font-size: 13px; gap: 5px; flex: 0 0 auto; }

    .drawer-btn {
      display: flex; align-items: center; gap: 10px; width: 100%;
      height: 48px; padding: 0 10px 0 12px;
      border-top: 1px solid var(--bh-divider); background: transparent;
      transition: background-color 180ms;
    }
    .drawer-btn.open { background: var(--bh-shape); }
    .drawer-btn:hover { background: var(--bh-shape); }
    .drawer-btn > ha-icon { --mdc-icon-size: 20px; color: var(--secondary-text-color); flex: 0 0 auto; }
    .drawer-btn .label { flex: 1; text-align: left; min-width: 0; }
    .drawer-btn .label b {
      display: block; font-size: 14px; font-weight: 500; line-height: 18px;
      color: var(--primary-text-color);
    }
    .drawer-btn .label span {
      display: block; font-size: 11.5px; line-height: 15px; color: var(--secondary-text-color);
      white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
    }
    .chevron {
      width: 32px; height: 32px; border-radius: 50%; flex: 0 0 auto;
      display: flex; align-items: center; justify-content: center;
      background: var(--bh-shape);
    }
    .chevron ha-icon { --mdc-icon-size: 22px; color: var(--secondary-text-color); }

    .drawer { padding: 6px 10px 12px; display: flex; flex-direction: column; gap: 2px; }
    .drawer .row { padding: 6px; }
    .drawer-title { padding: 8px 6px 4px; }
    .drawer-title b {
      display: block; font-size: 12px; font-weight: 500; letter-spacing: .06em;
      text-transform: uppercase; color: var(--secondary-text-color);
    }
    .drawer-title span {
      display: block; font-size: 11.5px; line-height: 1.4; margin-top: 2px;
      color: var(--secondary-text-color); opacity: .85;
    }
    .hr { height: 1px; background: var(--bh-divider); margin: 8px 6px; }

    .stepper {
      display: flex; align-items: center; gap: 2px; height: 38px; flex: 0 0 auto;
      background: var(--bh-shape); border-radius: 12px; padding: 0 4px;
    }
    .stepper button {
      width: 32px; height: 30px; border-radius: 9px;
      display: flex; align-items: center; justify-content: center;
      color: var(--primary-text-color);
    }
    .stepper button:hover { background: var(--bh-track); }
    .stepper button ha-icon { --mdc-icon-size: 18px; }
    .stepper .val {
      min-width: 52px; text-align: center; font-size: 13px; font-weight: 500;
      color: var(--primary-text-color); font-variant-numeric: tabular-nums;
    }

    /* Below roughly a phone-width card the header's "model · status" line and
       the drawer subtitles no longer fit on one line. Wrap them instead of
       ellipsing, so no information is lost; wider cards are unaffected. */
    @container (max-width: 344px) {
      .head .secondary,
      .drawer .row .secondary { white-space: normal; }
    }

    .toast {
      margin: 0 10px 10px; padding: 8px 12px; border-radius: 12px;
      background: rgba(${RGB.orange}, .16); color: rgb(${RGB.orange});
      font-size: 12.5px; line-height: 1.4;
    }
  `;

  const ZONE_STYLES = `
    .zone-actions { display: flex; gap: 8px; padding: 0 10px 10px; }
    .zone-actions .btn { flex: 1; }
    .rows { padding: 0 10px 6px; }
    .rows .row { padding: 6px; }
    .rows .row.first { border-top: 1px solid var(--bh-divider); }
    .rows .row.last { padding-bottom: 10px; }
  `;

  // ---------------------------------------------------------------------------
  // Formatting helpers (shared by both cards)
  // ---------------------------------------------------------------------------
  function esc(str) {
    return String(str == null ? '' : str)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function num(value) {
    const n = parseFloat(value);
    return Number.isFinite(n) ? n : null;
  }

  // 372 → "6:12"
  function fmtClock(seconds) {
    const s = Math.max(0, Math.round(seconds));
    return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
  }

  function fmtDuration(minutes) {
    const m = num(minutes);
    return m == null ? null : Math.round(m) + ' min';
  }

  function fmtTime(date) {
    try {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch (e) { return ''; }
  }

  // Next occurrence, phrased the way the design shows it: "Tue 06:00".
  function relativeFuture(value) {
    const d = value instanceof Date ? value : new Date(value);
    if (!d || isNaN(d.getTime())) return null;
    const now = new Date();
    const days = Math.round(
      (new Date(d.getFullYear(), d.getMonth(), d.getDate()) -
       new Date(now.getFullYear(), now.getMonth(), now.getDate())) / 86400000
    );
    if (days === 0) return 'Today ' + fmtTime(d);
    if (days === 1) return 'Tomorrow ' + fmtTime(d);
    return d.toLocaleDateString([], { weekday: 'short' }) + ' ' + fmtTime(d);
  }

  // "3 d ago" / "4 h ago" / "12 min ago"
  function fmtSince(value) {
    const d = value instanceof Date ? value : new Date(value);
    if (!d || isNaN(d.getTime())) return null;
    const mins = Math.max(0, Math.round((Date.now() - d.getTime()) / 60000));
    if (mins < 60) return mins + ' min ago';
    if (mins < 1440) return Math.floor(mins / 60) + ' h ago';
    return Math.floor(mins / 1440) + ' d ago';
  }

  function batteryIcon(pct) {
    return pct != null && pct <= 20 ? ICON.batteryLow : ICON.battery;
  }

  // ---------------------------------------------------------------------------
  // Markup helpers
  // ---------------------------------------------------------------------------
  // A chip is either neutral (--bh-chip fill, secondary icon) or tinted with a
  // colour at 22% — the two treatments in the design's chip() helper.
  function chipHtml(icon, label, rgb, tinted) {
    const style = tinted
      ? ` style="background: rgba(${rgb}, .22); color: rgb(${rgb});"`
      : '';
    const iconStyle = tinted ? ` style="color: rgb(${rgb});"` : '';
    return `<div class="chip"${style}>` +
           `<ha-icon icon="${esc(icon)}"${iconStyle}></ha-icon>` +
           `<span>${esc(label)}</span></div>`;
  }

  function shapeHtml(icon, rgb, size) {
    const cls = size ? ' ' + size : '';
    return `<div class="shape${cls}" style="background: rgba(${rgb}, .2);">` +
           `<ha-icon icon="${esc(icon)}" style="color: rgb(${rgb});"></ha-icon></div>`;
  }

  function swHtml(on, purple, dataAttrs) {
    return `<button class="sw${on ? ' on' : ''}${purple ? ' purple' : ''}" ${dataAttrs || ''}>` +
           `<span class="sw-knob"></span></button>`;
  }

  // ---------------------------------------------------------------------------
  // Entity/device registry discovery
  //
  // Cached per page load: the registry only changes when devices are added or
  // renamed, and a Lovelace reload picks that up.
  // ponytail: one module-level cache, refresh on reload — no invalidation logic.
  // ---------------------------------------------------------------------------
  let _registry = null;   // { entities: [], devices: {} }
  let _registryPromise = null;

  function loadRegistry(hass) {
    if (_registry) return Promise.resolve(_registry);
    if (_registryPromise) return _registryPromise;
    if (!hass || typeof hass.callWS !== 'function') return Promise.resolve(null);

    _registryPromise = Promise.all([
      hass.callWS({ type: 'config/entity_registry/list' }),
      hass.callWS({ type: 'config/device_registry/list' }),
    ]).then(([entities, devices]) => {
      const byId = {};
      (devices || []).forEach(d => { byId[d.id] = d; });
      _registry = {
        entities: (entities || []).filter(e => e.platform === 'bhyve'),
        devices:  byId,
      };
      return _registry;
    }).catch(() => {
      _registryPromise = null;
      return null;
    });

    return _registryPromise;
  }

  function objectId(entityId) {
    return String(entityId || '').split('.').slice(1).join('.');
  }

  // Entities registered to the same device as `entityId`.
  function siblingsOf(entityId) {
    if (!_registry) return [];
    const self = _registry.entities.find(e => e.entity_id === entityId);
    if (!self || !self.device_id) return [];
    return _registry.entities.filter(e => e.device_id === self.device_id);
  }

  function deviceIdOf(entityId) {
    if (!_registry) return null;
    const self = _registry.entities.find(e => e.entity_id === entityId);
    return self ? self.device_id : null;
  }

  function entitiesOfDevice(deviceId) {
    if (!_registry || !deviceId) return [];
    return _registry.entities.filter(e => e.device_id === deviceId);
  }

  function matches(entityId, domain, suffix) {
    const id = String(entityId || '');
    return id.startsWith(domain + '.') && id.endsWith(suffix);
  }

  // Resolve one related entity for a zone.
  //
  // A name match always wins. Failing that, a lone candidate is assumed to be
  // device-level and shared (fault, rain delay, device mode). That assumption
  // is wrong for per-zone entities — hub, battery, history, smart watering —
  // on a multi-zone device, where a zone lacking its own sensor would silently
  // borrow a sibling zone's reading, so those require the match unless the
  // device only has one zone to begin with.
  function pickForZone(candidates, zoneEntityId, opts) {
    const o = opts || {};
    if (!candidates.length) return null;
    const zoneTokens = objectId(zoneEntityId).split('_').filter(Boolean);
    const exact = zoneTokens.length ? candidates.find(c => {
      const tokens = objectId(c).split('_').filter(Boolean);
      return zoneTokens.every(t => tokens.includes(t));
    }) : null;
    if (exact) return exact;
    if (o.perZone && o.zoneCount > 1) return null;
    return candidates.length === 1 ? candidates[0] : null;
  }

  // ---------------------------------------------------------------------------
  // Resolvers — turn one entity into the full set of related B-hyve entities.
  // Explicit config always wins over discovery.
  // ---------------------------------------------------------------------------
  function resolveZone(hass, zoneEntityId, cfg) {
    const c   = cfg || {};
    const sib = siblingsOf(zoneEntityId).map(e => e.entity_id);
    const zoneCount = sib.filter(id => id.startsWith('valve.')).length;
    const pick = (suffix, domain, perZone) =>
      pickForZone(sib.filter(id => matches(id, domain, suffix)), zoneEntityId,
                  { perZone: perZone, zoneCount: zoneCount });

    const zoneState = hass && hass.states ? hass.states[zoneEntityId] : null;
    const station   = zoneState ? zoneState.attributes.station : null;

    // Programs are device-level; a program belongs to this zone when one of its
    // run_times targets this zone's station.
    let programs = c.program_entities;
    if (!programs) {
      programs = sib
        .filter(id => matches(id, 'switch', '_program'))
        .filter(id => {
          if (station == null) return true;
          const runTimes = hass && hass.states[id]
            ? hass.states[id].attributes.run_times : null;
          if (!Array.isArray(runTimes)) return true;
          return runTimes.some(rt => String(rt.station) === String(station));
        });
    }

    return {
      station,
      hub:           c.hub_entity            || pick('_connected', 'binary_sensor', true),
      battery:       c.battery_entity        || pick('_battery_level', 'sensor', true),
      history:       c.history_entity        || pick('_zone_history', 'sensor', true),
      fault:         c.fault_entity          || pick('_fault', 'binary_sensor'),
      rainDelay:     c.rain_delay_entity     || pick('_rain_delay', 'switch'),
      smartWatering: c.smart_watering_entity || pick('_smart_watering', 'switch', true),
      nextWatering:  c.next_watering_entity  || pick('_next_watering', 'sensor'),
      weeklyVolume:  c.weekly_volume_entity  || null,
      programs:      programs || [],
    };
  }

  // Zones read in the order the controller numbers them, not alphabetically.
  function sortByStation(hass, zoneIds) {
    const station = id => {
      const st = hass && hass.states ? hass.states[id] : null;
      const n = st ? num(st.attributes.station) : null;
      return n == null ? Number.MAX_SAFE_INTEGER : n;
    };
    return zoneIds.slice().sort((a, b) => {
      const d = station(a) - station(b);
      return d !== 0 ? d : a.localeCompare(b);
    });
  }

  function resolveDevice(hass, deviceId, cfg) {
    const c   = cfg || {};
    const ids = entitiesOfDevice(deviceId).map(e => e.entity_id);
    const one = (suffix, domain) => ids.filter(id => matches(id, domain, suffix))[0] || null;
    const dev = _registry ? _registry.devices[deviceId] : null;

    return {
      name:          c.name || (dev ? (dev.name_by_user || dev.name) : null) || 'B-hyve',
      zones:         sortByStation(hass, ids.filter(id => id.startsWith('valve.'))),
      mode:          c.device_mode_entity  || one('_device_mode', 'select'),
      nextWatering:  c.next_watering_entity || one('_next_watering', 'sensor'),
      rainDelay:     c.rain_delay_entity   || one('_rain_delay', 'switch'),
      fault:         c.fault_entity        || one('_fault', 'binary_sensor'),
      battery:       c.battery_entity      || one('_battery_level', 'sensor'),
      weeklyVolume:  c.weekly_volume_entity || null,
      programs:      c.program_entities || ids.filter(id => matches(id, 'switch', '_program')).sort(),
    };
  }

  function isFloodEntity(hass, entityId) {
    if (!entityId || !entityId.startsWith('binary_sensor.')) return false;
    const st = hass && hass.states ? hass.states[entityId] : null;
    const dc = st ? st.attributes.device_class : null;
    return dc === 'moisture' || /_flood_sensor$/.test(entityId);
  }

  // ---------------------------------------------------------------------------
  // Shared card base
  // ---------------------------------------------------------------------------
  class BhyveBase extends HTMLElement {
    constructor() {
      super();
      this.attachShadow({ mode: 'open' });
      this._config     = null;
      this._hass       = null;
      this._pendingOn  = new Set();
      this._pendingOff = new Set();
      this._runMinutes = {};    // entity_id → minutes we started it with
      this._tick       = null;
    }

    set hass(hass) {
      this._hass = hass;
      this._pendingOn.forEach(id => {
        const s = hass.states[id] && hass.states[id].state;
        if (s === 'on' || s === 'open') this._pendingOn.delete(id);
      });
      this._pendingOff.forEach(id => {
        const s = hass.states[id] && hass.states[id].state;
        if (s === 'off' || s === 'closed') this._pendingOff.delete(id);
      });
      this._ensureRegistry();
      this._render();
    }

    get hass() { return this._hass; }

    disconnectedCallback() { this._syncTick(false); }

    _ensureRegistry() {
      if (_registry || this._regRequested) return;
      this._regRequested = true;
      loadRegistry(this._hass).then(() => this._render());
    }

    // ── State access ─────────────────────────────────────────────
    _st(id) { return (id && this._hass) ? (this._hass.states[id] || null) : null; }

    _attr(id, key, fallback) {
      const st = this._st(id);
      const v  = st && st.attributes ? st.attributes[key] : undefined;
      return v === undefined ? (fallback === undefined ? null : fallback) : v;
    }

    _isOn(id) {
      if (!id) return false;
      if (this._pendingOn.has(id))  return true;
      if (this._pendingOff.has(id)) return false;
      const st = this._st(id);
      return !!st && (st.state === 'on' || st.state === 'open');
    }

    _isUnavailable(id) {
      const st = this._st(id);
      return !st || st.state === 'unavailable' || st.state === 'unknown';
    }

    _svc(domain, service, data) {
      if (!this._hass) return Promise.reject(new Error('no hass'));
      return Promise.resolve(this._hass.callService(domain, service, data));
    }

    _hasService(domain, service) {
      const s = this._hass && this._hass.services && this._hass.services[domain];
      return !!(s && s[service]);
    }

    _moreInfo(entityId) {
      this.dispatchEvent(new CustomEvent('hass-more-info', {
        detail: { entityId }, bubbles: true, composed: true,
      }));
    }

    // ── Watering ─────────────────────────────────────────────────
    _runZone(entityId, minutes) {
      const mins = parseInt(minutes, 10) || 10;
      this._pendingOn.add(entityId);
      this._pendingOff.delete(entityId);
      this._runMinutes[entityId] = mins;
      if (this._hasService('bhyve', 'start_watering')) {
        this._svc('bhyve', 'start_watering', { entity_id: entityId, minutes: mins });
      } else if (entityId.startsWith('valve.')) {
        this._svc('valve', 'open_valve', { entity_id: entityId });
      } else {
        this._svc('homeassistant', 'turn_on', { entity_id: entityId });
      }
      this._render();
      setTimeout(() => { this._pendingOn.delete(entityId); this._render(); }, 15000);
    }

    _stopZone(entityId) {
      this._pendingOff.add(entityId);
      this._pendingOn.delete(entityId);
      if (this._hasService('bhyve', 'stop_watering')) {
        this._svc('bhyve', 'stop_watering', { entity_id: entityId });
      } else if (entityId.startsWith('valve.')) {
        this._svc('valve', 'close_valve', { entity_id: entityId });
      } else {
        this._svc('homeassistant', 'turn_off', { entity_id: entityId });
      }
      this._render();
      setTimeout(() => { this._pendingOff.delete(entityId); this._render(); }, 8000);
    }

    _toggle(entityId) {
      if (!entityId) return;
      const on = this._isOn(entityId);
      if (on) { this._pendingOff.add(entityId); this._pendingOn.delete(entityId); }
      else    { this._pendingOn.add(entityId); this._pendingOff.delete(entityId); }
      this._svc('homeassistant', on ? 'turn_off' : 'turn_on', { entity_id: entityId });
      this._render();
      setTimeout(() => {
        this._pendingOn.delete(entityId); this._pendingOff.delete(entityId); this._render();
      }, 8000);
    }

    _setRainDelay(entityId, hours) {
      if (!entityId) return;
      if (this._isOn(entityId)) {
        this._pendingOff.add(entityId); this._pendingOn.delete(entityId);
        if (this._hasService('bhyve', 'disable_rain_delay')) {
          this._svc('bhyve', 'disable_rain_delay', { entity_id: entityId });
        } else {
          this._svc('homeassistant', 'turn_off', { entity_id: entityId });
        }
      } else {
        this._pendingOn.add(entityId); this._pendingOff.delete(entityId);
        if (this._hasService('bhyve', 'enable_rain_delay')) {
          this._svc('bhyve', 'enable_rain_delay', { entity_id: entityId, hours: hours || 24 });
        } else {
          this._svc('homeassistant', 'turn_on', { entity_id: entityId });
        }
      }
      this._render();
      setTimeout(() => {
        this._pendingOn.delete(entityId); this._pendingOff.delete(entityId); this._render();
      }, 8000);
    }

    // The integration reports manual_preset_runtime in SECONDS — its source
    // field is literally `manual_preset_runtime_sec`, and the integration
    // divides by 60 itself before watering. Both bhyve.start_watering and
    // bhyve.set_manual_preset_runtime take MINUTES. Every read goes through
    // here so that asymmetry is handled exactly once.
    _presetRuntimeMinutes(zoneEntityId) {
      const seconds = num(this._attr(zoneEntityId, 'manual_preset_runtime'));
      return seconds == null ? null : seconds / 60;
    }

    // Seconds left on a running zone, recomputed from the start timestamp.
    _remaining(zoneEntityId, fallbackMinutes) {
      const startedAt = this._attr(zoneEntityId, 'started_watering_station_at');
      const minutes = this._runMinutes[zoneEntityId]
        || this._presetRuntimeMinutes(zoneEntityId)
        || fallbackMinutes || 10;
      if (!startedAt) return null;
      const start = new Date(startedAt);
      if (isNaN(start.getTime())) return null;
      const left = minutes * 60 - (Date.now() - start.getTime()) / 1000;
      return left > 0 ? left : 0;
    }

    // 1s cadence while anything is running — the countdown and progress bar
    // are computed from the start timestamp, not pushed by HA.
    _syncTick(running) {
      if (running && !this._tick) {
        this._tick = setInterval(() => this._render(), 1000);
      } else if (!running && this._tick) {
        clearInterval(this._tick); this._tick = null;
      }
    }

    _emptyHtml() {
      return `
        <div class="empty">
          ${shapeHtml(ICON.zone, RGB.grey, 'xl')}
          <div>
            <div class="primary">No B-hyve devices found</div>
            <div class="sub">Add the Orbit B-hyve integration, or check that this
            card's entities still exist.</div>
          </div>
        </div>`;
    }

  }

  const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  // "Mon, Wed, Fri · 06:00 · 10 min"
  function programSummary(hass, programEntityId, station) {
    const st = hass && hass.states ? hass.states[programEntityId] : null;
    if (!st) return '';
    const a = st.attributes || {};
    const parts = [];

    const freq = a.frequency || {};
    if (Array.isArray(freq.days) && freq.days.length) {
      parts.push(freq.days.map(d => DAY_NAMES[d] || d).join(', '));
    } else if (freq.interval) {
      parts.push('Every ' + freq.interval + ' days');
    } else if (a.is_smart_program) {
      parts.push('Weather adjusted');
    }

    const times = Array.isArray(a.start_times) ? a.start_times
      : (a.start_times ? [a.start_times] : []);
    if (times.length) parts.push(times.join(', '));

    if (Array.isArray(a.run_times) && a.run_times.length) {
      if (station != null) {
        const rt = a.run_times.find(r => String(r.station) === String(station));
        if (rt && rt.run_time != null) parts.push(fmtDuration(rt.run_time));
      } else {
        // Device-level list: one figure if every zone runs the same length,
        // otherwise the span across zones.
        const mins = a.run_times.map(r => num(r.run_time)).filter(v => v != null);
        if (mins.length) {
          const lo = Math.min.apply(null, mins), hi = Math.max.apply(null, mins);
          parts.push(lo === hi ? fmtDuration(lo)
                               : Math.round(lo) + '\u2013' + fmtDuration(hi));
        }
      }
    }
    return parts.filter(Boolean).join(' · ');
  }

  function programName(hass, programEntityId) {
    const st = hass && hass.states ? hass.states[programEntityId] : null;
    if (!st) return objectId(programEntityId);
    const a = st.attributes || {};
    const friendly = a.friendly_name || objectId(programEntityId);
    return a.program && a.name ? ('Program ' + String(a.program).toUpperCase() + ' · ' + a.name)
                               : friendly;
  }

  function programIcon(hass, programEntityId) {
    const st = hass && hass.states ? hass.states[programEntityId] : null;
    return st && st.attributes && st.attributes.is_smart_program ? ICON.smart : ICON.calendar;
  }

  // Human-readable fault text from binary_sensor.*_fault's station_faults.
  function faultText(hass, faultEntityId, station) {
    const st = hass && hass.states ? hass.states[faultEntityId] : null;
    if (!st || st.state !== 'on') return null;
    const faults = st.attributes ? st.attributes.station_faults : null;
    const list = Array.isArray(faults) ? faults : (faults ? [faults] : []);
    const mine = station == null ? list
      : list.filter(f => f == null || typeof f !== 'object' ||
                    f.station == null || String(f.station) === String(station));
    if (station != null && list.length && !mine.length) return null;

    const article = word => /^[aeiou]/i.test(word) ? 'an' : 'a';
    const describe = f => {
      if (f == null) return null;
      if (typeof f === 'string') return f;
      const where = f.station != null ? 'Station ' + f.station : 'This station';
      const what  = String(f.fault || f.type || f.name || 'fault').replace(/_/g, ' ');
      return where + ' reports ' + article(what) + ' ' + what + '.';
    };
    const text = mine.map(describe).filter(Boolean).join(' ');
    return (text || 'This station reports a fault.') +
           ' Watering is blocked until it clears.';
  }

  function rainDelayHours(hass, rainEntityId) {
    const st = hass && hass.states ? hass.states[rainEntityId] : null;
    if (!st) return null;
    const a = st.attributes || {};
    return num(a.delay) || num(a.rain_delay) || num(a.hours);
  }

  // ---------------------------------------------------------------------------
  // Zone card
  // ---------------------------------------------------------------------------
  class BhyveZoneCard extends BhyveBase {
    static getConfigElement() { return document.createElement(ZONE_ED); }
    static getStubConfig(hass) {
      const valve = hass && hass.states
        ? Object.keys(hass.states).find(id => id.startsWith('valve.')) : null;
      return { entity: valve || '', run_time: 10 };
    }

    setConfig(config) {
      if (!config || !config.entity) {
        throw new Error('[bhyve-zone-card] "entity" is required (the zone valve).');
      }
      this._config = Object.assign({ run_time: 10, show_programs: true }, config);
      if (this._hass) this._render();
    }

    getCardSize() { return 4; }

    _render() {
      if (!this._config || !this._hass) return;
      const c = this._config;

      if (isFloodEntity(this._hass, c.entity)) { this._renderFlood(); return; }

      const zoneId = c.entity;
      const r      = resolveZone(this._hass, zoneId, c);
      const st     = this._st(zoneId);

      const unavailable = this._isUnavailable(zoneId);
      const fault       = !unavailable && r.fault
        ? faultText(this._hass, r.fault, r.station) : null;
      const running     = !unavailable && !fault && this._isOn(zoneId);

      const name = c.name || (st && st.attributes.zone_name)
        || (st && st.attributes.friendly_name) || objectId(zoneId);

      let accent = RGB.grey, icon = ICON.zone, secondary, secColor = '';
      if (unavailable) {
        icon = ICON.unknown;
        secondary = 'Unavailable · entity not reporting';
      } else if (fault) {
        accent = RGB.red;
        secondary = 'Fault · will not run';
        secColor = ` style="color: rgb(${RGB.red});"`;
      } else if (running) {
        accent = RGB.accent;
        const left = this._remaining(zoneId, c.run_time);
        secondary = left == null ? 'Watering' : 'Watering · ' + fmtClock(left) + ' left';
        secColor = ` style="color: rgb(${RGB.accent});"`;
      } else {
        secondary = r.station != null ? 'Idle · station ' + r.station : 'Idle';
      }

      const chips = unavailable ? this._unavailableChips(r) : this._chips(r, running);
      const rows  = (unavailable || fault) ? '' : this._rows(r);

      let bar = '';
      if (running) {
        const left  = this._remaining(zoneId, c.run_time);
        const total = (this._runMinutes[zoneId]
          || this._presetRuntimeMinutes(zoneId) || c.run_time || 10) * 60;
        const pct = left == null ? 0 : Math.max(0, Math.min(100, (1 - left / total) * 100));
        bar = `<div class="bar"><div style="width: ${pct}%;"></div></div>`;
      }

      this.shadowRoot.innerHTML = `
        <style>${BASE_STYLES}${ZONE_STYLES}</style>
        <ha-card class="${fault ? 'accent-red' : ''}">
          <div class="row">
            ${shapeHtml(icon, accent, 'lg')}
            <div class="grow">
              <div class="primary${unavailable ? ' muted' : ''} zone-name">${esc(name)}</div>
              <div class="secondary"${secColor}>${esc(secondary)}</div>
            </div>
          </div>
          ${fault ? `<div class="banner red">
            <ha-icon icon="${ICON.warn}"></ha-icon><span>${esc(fault)}</span></div>` : ''}
          ${unavailable ? '' : this._actions(r, running, !!fault)}
          ${bar}
          <div class="chips">${chips}</div>
          ${rows}
        </ha-card>
      `;

      this._bind(r);
      this._syncTick(running);
    }

    // Fixed order: hub → battery → last run → last volume → week → next/rain.
    _chips(r, running) {
      const out = [];

      if (r.hub) {
        const online = this._isOn(r.hub);
        out.push(online
          ? chipHtml(ICON.wifi, 'Hub online', RGB.green, true)
          : chipHtml(ICON.wifiOff, 'Hub offline', RGB.red, true));
      }

      const battery = num(this._st(r.battery) && this._st(r.battery).state);
      if (battery != null) {
        const low = battery <= 20;
        out.push(chipHtml(batteryIcon(battery), Math.round(battery) + '%',
                          low ? RGB.orange : RGB.green, low));
      }

      // Duration and volume come from the same history entry, so they appear
      // and disappear together.
      const runTime = this._attr(r.history, 'run_time');
      if (r.history && runTime != null) {
        out.push(chipHtml(ICON.history, fmtDuration(runTime), RGB.grey, false));
        const gal = num(this._attr(r.history, 'consumption_gallons'));
        if (gal != null) out.push(chipHtml(ICON.drop, gal.toFixed(1) + ' gal', RGB.grey, false));
      }

      // Optional, and never rendered as a zero.
      const week = num(this._st(r.weeklyVolume) && this._st(r.weeklyVolume).state);
      if (r.weeklyVolume && week != null && week > 0) {
        out.push(chipHtml(ICON.chart, week.toFixed(1) + ' gal', RGB.grey, false));
      }

      // One slot: rain delay replaces next run while it is active.
      if (r.rainDelay && this._isOn(r.rainDelay)) {
        const h = rainDelayHours(this._hass, r.rainDelay);
        out.push(chipHtml(ICON.rain, h ? 'Delay ' + h + ' h' : 'Rain delay', RGB.accent, true));
      } else {
        const next = this._nextRun(r);
        if (next) out.push(chipHtml(ICON.clock, next, RGB.grey, false));
      }
      return out.join('');
    }

    _unavailableChips(r) {
      const out = [];
      if (r.hub) {
        const online = this._isOn(r.hub);
        out.push(online
          ? chipHtml(ICON.wifi, 'Hub online', RGB.green, true)
          : chipHtml(ICON.wifiOff, 'Hub offline', RGB.red, true));
      }
      const st = this._st(this._config.entity);
      const seen = st ? fmtSince(st.last_changed) : null;
      if (seen) out.push(chipHtml(ICON.clock, 'Last seen ' + seen, RGB.grey, false));
      return out.join('');
    }

    _nextRun(r) {
      const attrNext = this._attr(this._config.entity, 'next_start_time');
      if (attrNext) {
        const label = relativeFuture(attrNext);
        if (label) return label;
      }
      const st = this._st(r.nextWatering);
      if (st && !['unavailable', 'unknown', ''].includes(st.state)) {
        return relativeFuture(st.state);
      }
      return null;
    }

    _actions(r, running, blocked) {
      const c = this._config;
      // Label and dispatched value are derived from one rounded integer, so a
      // display fix can never drift from what actually gets watered.
      const mins = Math.max(1, Math.round(
        this._presetRuntimeMinutes(c.entity) || c.run_time || 10));

      let main;
      if (blocked) {
        main = `<button class="btn blocked" disabled>
          <ha-icon icon="${ICON.blocked}"></ha-icon>Run blocked</button>`;
      } else if (running) {
        main = `<button class="btn stop" data-act="stop">
          <ha-icon icon="${ICON.stop}"></ha-icon>Stop</button>`;
      } else {
        main = `<button class="btn" data-act="run" data-minutes="${mins}">
          <ha-icon icon="${ICON.play}"></ha-icon>Run ${mins} min</button>`;
      }

      // Same rule as the chip row: render only what there is data for.
      const rain = r.rainDelay ? `
          <button class="icon-btn accent${this._isOn(r.rainDelay) ? ' on' : ''}"
            data-act="rain" title="Rain delay">
            <ha-icon icon="${ICON.rain}"></ha-icon></button>` : '';
      const smart = r.smartWatering ? `
          <button class="icon-btn purple${this._isOn(r.smartWatering) ? ' on' : ''}"
            data-act="smart" title="Smart watering">
            <ha-icon icon="${ICON.smart}"></ha-icon></button>` : '';
      return `
        <div class="zone-actions">
          ${main}${rain}${smart}
        </div>`;
    }

    // Rendered inline — the zone card has no expander.
    _rows(r) {
      // Omitted from the DOM entirely, like every other optional element here.
      if (this._config.show_programs === false) return '';
      const rows = [];

      if (r.smartWatering) {
        const on = this._isOn(r.smartWatering);
        const moisture = num(this._attr(r.smartWatering, 'soil_moisture_level'))
          ?? num(this._attr(r.smartWatering, 'soil_moisture'));
        const detail = moisture != null
          ? 'Soil moisture ' + Math.round(moisture) + '%' : (on ? 'Enabled' : 'Disabled');
        rows.push(`
          <div class="row first">
            ${shapeHtml(ICON.smart, on ? RGB.purple : RGB.grey)}
            <div class="grow">
              <div class="primary">Smart watering</div>
              <div class="secondary">${esc(detail)}</div>
            </div>
            ${swHtml(on, true, `data-act="toggle" data-entity="${esc(r.smartWatering)}"`)}
          </div>`);
      }

      (r.programs || []).forEach((pid, i) => {
        const on = this._isOn(pid);
        const last = i === r.programs.length - 1 ? ' last' : '';
        const first = !r.smartWatering && i === 0 ? ' first' : '';
        rows.push(`
          <div class="row${first}${last}">
            ${shapeHtml(programIcon(this._hass, pid), on ? RGB.accent : RGB.grey)}
            <div class="grow">
              <div class="primary">${esc(programName(this._hass, pid))}</div>
              <div class="secondary">${esc(programSummary(this._hass, pid, r.station))}</div>
            </div>
            ${swHtml(on, false, `data-act="toggle" data-entity="${esc(pid)}"`)}
          </div>`);
      });

      return rows.length ? `<div class="rows">${rows.join('')}</div>` : '';
    }

    _renderFlood() {
      const c    = this._config;
      const st   = this._st(c.entity);
      const wet  = !!st && st.state === 'on';
      const sib  = siblingsOf(c.entity).map(e => e.entity_id);
      const pick = (suffix, domain) =>
        pickForZone(sib.filter(id => matches(id, domain, suffix)), c.entity);

      const temp   = c.temperature_entity || pick('_temperature', 'sensor');
      const signal = c.signal_entity      || pick('_signal_strength', 'sensor');
      const batt   = c.battery_entity     || pick('_battery_level', 'sensor')
                                          || pick('_battery', 'sensor');

      const name = c.name || (st && st.attributes.friendly_name) || objectId(c.entity);
      const when = st ? fmtTime(new Date(st.last_changed)) : '';
      const secondary = wet ? 'Water detected · ' + when : 'Dry';

      const chips = [];
      const t = num(this._st(temp) && this._st(temp).state);
      if (t != null) {
        const unit = this._attr(temp, 'unit_of_measurement', '°F');
        chips.push(chipHtml(ICON.thermo, Math.round(t) + ' ' + unit, RGB.grey, false));
      }
      const sig = num(this._st(signal) && this._st(signal).state);
      if (sig != null) chips.push(chipHtml(ICON.wifi, sig + ' dBm', RGB.grey, false));
      const b = num(this._st(batt) && this._st(batt).state);
      if (b != null) {
        const low = b <= 20;
        chips.push(chipHtml(batteryIcon(b), Math.round(b) + '%',
                            low ? RGB.orange : RGB.green, low));
      }

      this.shadowRoot.innerHTML = `
        <style>${BASE_STYLES}${ZONE_STYLES}</style>
        <ha-card class="${wet ? 'accent-red' : ''}">
          <div class="row">
            ${shapeHtml(ICON.flood, wet ? RGB.red : RGB.accent, 'lg')}
            <div class="grow">
              <div class="primary">${esc(name)}</div>
              <div class="secondary"${wet ? ` style="color: rgb(${RGB.red});"` : ''}>${esc(secondary)}</div>
            </div>
          </div>
          <div class="chips">${chips.join('')}</div>
        </ha-card>`;
    }

    _bind(r) {
      const root = this.shadowRoot;

      const name = root.querySelector('.zone-name');
      if (name) name.addEventListener('click', () => this._moreInfo(this._config.entity));

      root.querySelectorAll('[data-act]').forEach(el => {
        el.addEventListener('click', e => {
          e.stopPropagation();
          const act = el.dataset.act;
          if (act === 'run')        this._runZone(this._config.entity, el.dataset.minutes);
          else if (act === 'stop')  this._stopZone(this._config.entity);
          else if (act === 'rain')  this._setRainDelay(r.rainDelay, this._config.rain_delay_hours);
          else if (act === 'smart') this._toggle(r.smartWatering);
          else if (act === 'toggle') this._toggle(el.dataset.entity);
        });
      });
    }
  }

  // ---------------------------------------------------------------------------
  // Controller card
  // ---------------------------------------------------------------------------
  class BhyveControllerCard extends BhyveBase {
    constructor() {
      super();
      this._expanded    = false;
      this._runtime     = null;
      this._toast       = null;
      this._presetLocal = false;   // true once the device rejected the preset
    }

    static getConfigElement() { return document.createElement(CONTROLLER_ED); }
    static getStubConfig() { return { show_actions: true }; }

    setConfig(config) {
      if (!config) throw new Error('[bhyve-controller-card] Invalid configuration.');
      this._config = Object.assign({ show_actions: true, show_programs: true }, config);
      if (this._hass) this._render();
    }

    getCardSize() { return 6; }

    // Configured device, else the first discovered B-hyve device with zones.
    _deviceId() {
      if (this._config.device_id) return this._config.device_id;
      if (this._config.zones && this._config.zones.length) {
        return deviceIdOf(this._config.zones[0]);
      }
      if (!_registry) return null;
      const withZones = _registry.entities.filter(e => e.entity_id.startsWith('valve.'));
      return withZones.length ? withZones[0].device_id : null;
    }

    _zones(dev) {
      if (this._config.zones && this._config.zones.length) return this._config.zones;
      return dev ? dev.zones : [];
    }

    _presetMinutes(zones) {
      if (this._runtime != null) return this._runtime;
      for (const z of zones) {
        const m = this._presetRuntimeMinutes(z);
        if (m != null) return m;
      }
      return this._config.run_time || 10;
    }

    _render() {
      if (!this._config || !this._hass) return;

      const deviceId = this._deviceId();
      const dev      = deviceId ? resolveDevice(this._hass, deviceId, this._config) : null;
      const zones    = this._zones(dev);

      if (!dev || !zones.length) {
        this.shadowRoot.innerHTML = `
          <style>${BASE_STYLES}${CONTROLLER_STYLES}</style>
          <ha-card>
              ${this._emptyHtml()}
          </ha-card>`;
        return;
      }

      const showActions  = this._config.show_actions !== false;
      // show_actions already suppressed the drawer as part of hiding every
      // control; show_programs drops it on its own while leaving Run/Stop.
      const showPrograms = this._config.show_programs !== false;
      const running     = zones.filter(z => this._isOn(z));
      const rainOn      = !!dev.rainDelay && this._isOn(dev.rainDelay);
      const off         = !!dev.mode && this._st(dev.mode) && this._st(dev.mode).state === 'off';
      const anyFault    = !!dev.fault && this._isOn(dev.fault);

      let accent = RGB.green, status = 'All idle';
      if (anyFault)            { accent = RGB.red;    status = 'Fault detected'; }
      else if (running.length)  {
        accent = RGB.accent;
        status = running.length + (running.length === 1 ? ' zone watering'
                                                        : ' zones watering');
      } else if (rainOn)       { accent = RGB.accent; status = 'Rain delay active'; }
      else if (off)            { accent = RGB.orange; status = 'Off'; }

      const model = (_registry && _registry.devices[deviceId] &&
                     _registry.devices[deviceId].model) || 'B-hyve';
      const title = this._config.title || dev.name;

      this.shadowRoot.innerHTML = `
        <style>${BASE_STYLES}${CONTROLLER_STYLES}</style>
        <ha-card class="${anyFault ? 'accent-red' : ''}">
          <div class="row head">
            ${shapeHtml(ICON.controller, accent, 'lg')}
            <div class="grow">
              <div class="primary">${esc(title)}</div>
              <div class="secondary">${esc(model + ' · ' + status)}</div>
            </div>
            ${dev.mode ? `<div class="seg">
              <button class="${off ? '' : 'on'}" data-act="mode" data-option="auto">Auto</button>
              <button class="${off ? 'on' : ''}" data-act="mode" data-option="off">Off</button>
            </div>` : ''}
          </div>
          ${off ? `<div class="banner orange"><ha-icon icon="${ICON.warn}"></ha-icon>
            <span>Controller is off — no program will run.</span></div>` : ''}
          ${anyFault ? `<div class="banner red"><ha-icon icon="${ICON.warn}"></ha-icon>
            <span>${esc(faultText(this._hass, dev.fault, null) || 'A station reports a fault.')}</span></div>` : ''}
          ${this._toast ? `<div class="toast">${esc(this._toast)}</div>` : ''}
          <div class="zone-rows">${this._zoneRows(zones, showActions, off)}</div>
          <div class="chips">${this._chips(dev, zones)}</div>
          ${showActions && showPrograms ? this._drawer(dev, zones) : ''}
        </ha-card>`;

      this._bind(dev, zones);
      this._syncTick(running.length > 0);
    }

    _zoneName(zoneId) {
      const st = this._st(zoneId);
      return (st && (st.attributes.zone_name || st.attributes.friendly_name))
        || objectId(zoneId);
    }

    // Permanently-collapsed rows. Tapping the name opens more-info; a row never
    // expands into a zone card.
    _zoneRows(zones, showActions, off) {
      return zones.map(zoneId => {
        const running = this._isOn(zoneId);
        const rgb     = running ? RGB.accent : RGB.grey;
        // A value the user just dialled in wins over the reported attribute.
        // The integration never refreshes that attribute within a session, so
        // deferring to it would make the stepper look inert.
        const minutes = Math.max(1, Math.round(
          this._runtime != null
            ? this._runtime
            : (this._presetRuntimeMinutes(zoneId) || this._presetMinutes(zones))));

        let state = off ? 'Off' : 'Idle', stateStyle = '';
        if (running) {
          const left = this._remaining(zoneId, minutes);
          state = left == null ? 'Watering' : 'Watering · ' + fmtClock(left) + ' left';
          stateStyle = ` style="color: rgb(${RGB.accent});"`;
        }

        let pct = 0;
        if (running) {
          const left = this._remaining(zoneId, minutes);
          if (left != null) pct = Math.max(0, Math.min(100, (1 - left / (minutes * 60)) * 100));
        }

        const btn = showActions ? (running
          ? `<button class="btn stop" data-act="stop" data-entity="${esc(zoneId)}">
               <ha-icon icon="${ICON.stop}"></ha-icon>Stop</button>`
          : `<button class="btn" data-act="run" data-entity="${esc(zoneId)}"
               data-minutes="${minutes}">
               <ha-icon icon="${ICON.play}"></ha-icon>${minutes}m</button>`) : '';

        return `
          <div class="zone-row">
            <div class="row">
              ${shapeHtml(ICON.zone, rgb)}
              <div class="grow name" data-act="more-info" data-entity="${esc(zoneId)}">
                <div class="primary">${esc(this._zoneName(zoneId))}</div>
                <div class="secondary"${stateStyle}>${esc(state)}</div>
              </div>
              ${btn}
            </div>
            <div class="bar"><div style="width: ${pct}%;"></div></div>
          </div>`;
      }).join('');
    }

    _chips(dev, zones) {
      const out = [];

      const nextSt = this._st(dev.nextWatering);
      let next = nextSt && !['unavailable', 'unknown', ''].includes(nextSt.state)
        ? relativeFuture(nextSt.state) : null;
      if (!next) {
        // Fall back to the soonest next_start_time across this device's zones.
        const times = zones.map(z => this._attr(z, 'next_start_time'))
          .map(v => (v ? new Date(v) : null))
          .filter(d => d && !isNaN(d.getTime()) && d > new Date())
          .sort((a, b) => a - b);
        if (times.length) next = relativeFuture(times[0]);
      }
      if (next) out.push(chipHtml(ICON.clock, 'Next ' + next, RGB.grey, false));

      const battery = num(this._st(dev.battery) && this._st(dev.battery).state);
      if (battery != null) {
        const low = battery <= 20;
        out.push(chipHtml(batteryIcon(battery), Math.round(battery) + '%',
                          low ? RGB.orange : RGB.green, low));
      }

      const week = num(this._st(dev.weeklyVolume) && this._st(dev.weeklyVolume).state);
      if (dev.weeklyVolume && week != null && week > 0) {
        out.push(chipHtml(ICON.chart, week.toFixed(1) + ' gal this week', RGB.grey, false));
      }
      return out.join('');
    }

    _drawer(dev, zones) {
      const n    = (dev.programs || []).length;
      const hint = [n + ' program' + (n === 1 ? '' : 's'), 'rain delay', 'run time'].join(' · ');
      const open = this._expanded;

      if (!open) {
        return this._drawerBtn(hint, false);
      }

      const programs = (dev.programs || []).map(pid => {
        const on   = this._isOn(pid);
        const icon = programIcon(this._hass, pid);
        const rgb  = on ? (icon === ICON.smart ? RGB.purple : RGB.accent) : RGB.grey;
        return `
          <div class="row">
            ${shapeHtml(icon, rgb)}
            <div class="grow">
              <div class="primary">${esc(programName(this._hass, pid))}</div>
              <div class="secondary">${esc(programSummary(this._hass, pid, null))}</div>
            </div>
            ${swHtml(on, icon === ICON.smart, `data-act="toggle" data-entity="${esc(pid)}"`)}
          </div>`;
      }).join('');

      const rainOn = !!dev.rainDelay && this._isOn(dev.rainDelay);
      const hours  = rainDelayHours(this._hass, dev.rainDelay);
      const cause  = this._attr(dev.rainDelay, 'cause')
        || this._attr(dev.rainDelay, 'weather_type');
      const rainDetail = rainOn
        ? ['Active', hours ? hours + ' h remaining' : null, cause].filter(Boolean).join(' · ')
        : 'Off';

      const minutes = this._presetMinutes(zones);

      return this._drawerBtn(hint, true) + `
        <div class="drawer">
          <div class="drawer-title">
            <b>Programs · all zones</b>
            <span>Every program on this controller, merged — programs are
            device-level, not per zone.</span>
          </div>
          ${programs}
          <div class="hr"></div>
          <div class="row">
            ${shapeHtml(ICON.rain, rainOn ? RGB.accent : RGB.grey)}
            <div class="grow">
              <div class="primary">Rain delay</div>
              <div class="secondary">${esc(rainDetail)}</div>
            </div>
            ${swHtml(rainOn, false, 'data-act="rain"')}
          </div>
          <div class="row">
            ${shapeHtml(ICON.timer, RGB.accent)}
            <div class="grow">
              <div class="primary">Run time</div>
              <div class="secondary">Applies to every zone</div>
            </div>
            <div class="stepper">
              <button data-act="runtime" data-delta="-5" title="Less">
                <ha-icon icon="${ICON.minus}"></ha-icon></button>
              <span class="val">${Math.round(minutes)} min</span>
              <button data-act="runtime" data-delta="5" title="More">
                <ha-icon icon="${ICON.plus}"></ha-icon></button>
            </div>
          </div>
        </div>`;
    }

    _drawerBtn(hint, open) {
      return `
        <button class="drawer-btn${open ? ' open' : ''}" data-act="drawer">
          <ha-icon icon="${ICON.tune}"></ha-icon>
          <span class="label">
            <b>${open ? 'Hide' : 'Show'} programs &amp; settings</b>
            <span>${esc(hint)}</span>
          </span>
          <span class="chevron"><ha-icon icon="${open ? ICON.up : ICON.down}"></ha-icon></span>
        </button>`;
    }

    // Writes the preset to every zone on the controller, in MINUTES (the
    // service's unit — it multiplies by 60 itself). On a rejected or missing
    // service the value is kept as a session-only default and said so out loud.
    //
    // Note there is deliberately no "did the attribute change?" confirmation.
    // The integration assigns manual_preset_runtime once in the valve entity's
    // constructor and never refreshes it, so the attribute cannot change during
    // a session even when the device accepts the write. A timeout-based check
    // would therefore report failure every single time, including on success.
    _setRuntime(zones, delta) {
      const next = Math.max(1, Math.min(60, this._presetMinutes(zones) + delta));
      this._runtime = next;
      this._toast = null;
      this._render();

      console.debug('[bhyve-controller-card] set_manual_preset_runtime',
                    { entity_id: zones, minutes: next });

      const failed = reason => {
        this._presetLocal = true;
        this._toast = 'Device didn\u2019t accept this — using ' + next +
                      ' min as a local default only.';
        console.debug('[bhyve-controller-card] preset rejected, keeping local default',
                      { minutes: next, reason: reason });
        this._render();
      };

      if (!this._hasService('bhyve', 'set_manual_preset_runtime')) {
        failed('service not available');
        return;
      }

      this._svc('bhyve', 'set_manual_preset_runtime', { entity_id: zones, minutes: next })
        .then(() => { this._presetLocal = false; })
        .catch(err => {
          failed(err && err.message ? err.message : 'service call rejected');
          setTimeout(() => { this._toast = null; this._render(); }, 8000);
        });
    }

    _bind(dev, zones) {
      const root = this.shadowRoot;

      root.querySelectorAll('[data-act]').forEach(el => {
        el.addEventListener('click', e => {
          e.stopPropagation();
          const act = el.dataset.act;
          if (act === 'more-info')   this._moreInfo(el.dataset.entity);
          else if (act === 'run')    this._runZone(el.dataset.entity, el.dataset.minutes);
          else if (act === 'stop')   this._stopZone(el.dataset.entity);
          else if (act === 'toggle') this._toggle(el.dataset.entity);
          else if (act === 'rain')   this._setRainDelay(dev.rainDelay, this._config.rain_delay_hours);
          else if (act === 'drawer') { this._expanded = !this._expanded; this._render(); }
          else if (act === 'runtime') this._setRuntime(zones, parseInt(el.dataset.delta, 10));
          else if (act === 'mode' && dev.mode) {
            this._svc('select', 'select_option',
              { entity_id: dev.mode, option: el.dataset.option });
          }
        });
      });
    }
  }

  // ---------------------------------------------------------------------------
  // Config editors
  // ---------------------------------------------------------------------------
  // `show_programs` hides different things on each card, so the controller
  // spells out what its own drawer contains.
  const CONTROLLER_LABELS = {
    show_programs: 'Show programs & settings',
  };

  const LABELS = {
    title:        'Title (defaults to the device name)',
    device_id:    'B-hyve device',
    show_actions: 'Show Run/Stop buttons and the settings drawer',
    entity:       'Zone valve (or flood sensor)',
    name:         'Name override',
    run_time:     'Run time (minutes)',
    show_programs: 'Show smart watering and programs',
  };

  class BhyveEditorBase extends HTMLElement {
    constructor() {
      super();
      this.attachShadow({ mode: 'open' });
      this._config = {};
      this._hass   = null;
      // HA's dashboard shortcuts otherwise steal keystrokes from text fields.
      this.addEventListener('keydown', e => e.stopPropagation());
      this.addEventListener('keyup',   e => e.stopPropagation());
    }

    setConfig(config) { this._config = Object.assign({}, config || {}); this._render(); }
    set hass(hass)    { this._hass = hass; this._render(); }

    _computeLabel(schema) { return LABELS[schema.name] || schema.name; }

    _render() {
      if (!this._hass) return;

      if (!customElements.get('ha-form')) {
        this.shadowRoot.innerHTML =
          '<div style="padding:16px;color:var(--secondary-text-color)">Loading editor…</div>';
        customElements.whenDefined('ha-form').then(() => this._render());
        return;
      }

      if (!this._form) {
        this.shadowRoot.innerHTML = `<style>
          ha-form { display: block; }
          .hint {
            padding: 8px 4px 0; font-size: 12px; line-height: 1.5;
            color: var(--secondary-text-color);
          }
          code { font-family: ui-monospace, Menlo, monospace; }
        </style>`;
        this._form = document.createElement('ha-form');
        this._form.addEventListener('value-changed', e => {
          this._config = e.detail.value;
          this.dispatchEvent(new CustomEvent('config-changed', {
            detail: { config: this._config }, bubbles: true, composed: true,
          }));
        });
        this.shadowRoot.appendChild(this._form);
        const hint = document.createElement('div');
        hint.className = 'hint';
        hint.innerHTML = this._hint();
        this.shadowRoot.appendChild(hint);
      }

      this._form.hass         = this._hass;
      this._form.data         = this._config;
      this._form.schema       = this._schema();
      this._form.computeLabel = this._computeLabel;
    }

    _hint() { return ''; }
  }

  class BhyveControllerCardEditor extends BhyveEditorBase {
    // Deliberately free of `this` — ha-form calls computeLabel unbound.
    _computeLabel(schema) {
      return CONTROLLER_LABELS[schema.name] || LABELS[schema.name] || schema.name;
    }
    _schema() {
      return [
        { name: 'title',         selector: { text: {} } },
        { name: 'device_id',     selector: { device: { integration: 'bhyve' } } },
        { name: 'show_actions',  selector: { boolean: {} } },
        { name: 'show_programs', selector: { boolean: {} } },
      ];
    }
    _hint() {
      return 'Leave the device empty to use the first B-hyve controller found. ' +
             'Entity overrides (<code>device_mode_entity</code>, <code>rain_delay_entity</code>, ' +
             '<code>weekly_volume_entity</code>, <code>zones</code>) are YAML-only for now.';
    }
  }

  class BhyveZoneCardEditor extends BhyveEditorBase {
    _schema() {
      return [
        { name: 'entity', required: true,
          selector: { entity: { domain: ['valve', 'binary_sensor'] } } },
        { name: 'name',     selector: { text: {} } },
        { name: 'run_time', selector: { number: { min: 1, max: 60, mode: 'box',
                                                  unit_of_measurement: 'min' } } },
        { name: 'show_programs', selector: { boolean: {} } },
      ];
    }
    _hint() {
      return 'Everything else is auto-discovered from the zone\'s device. ' +
             'Overrides (<code>hub_entity</code>, <code>battery_entity</code>, ' +
             '<code>history_entity</code>, <code>program_entities</code>, ' +
             '<code>smart_watering_entity</code>, <code>rain_delay_entity</code>, ' +
             '<code>weekly_volume_entity</code>) are YAML-only for now.';
    }
  }

  // ---------------------------------------------------------------------------
  // Register
  // ---------------------------------------------------------------------------
  if (!customElements.get(CONTROLLER))    customElements.define(CONTROLLER,    BhyveControllerCard);
  if (!customElements.get(ZONE))          customElements.define(ZONE,          BhyveZoneCard);
  if (!customElements.get(CONTROLLER_ED)) customElements.define(CONTROLLER_ED, BhyveControllerCardEditor);
  if (!customElements.get(ZONE_ED))       customElements.define(ZONE_ED,       BhyveZoneCardEditor);

  window.customCards = window.customCards || [];
  const register = (type, name, description) => {
    if (!window.customCards.find(c => c.type === type)) {
      window.customCards.push({
        type, name, description, preview: true,
        documentationURL: 'https://github.com/reypm/Orbit-BHyve-Custom-Card',
      });
    }
  };
  register(CONTROLLER, 'B-hyve Controller Card',
    'Device overview: zone rows, status, programs and shared settings.');
  register(ZONE, 'B-hyve Zone Card',
    'Full detail for one B-hyve zone or flood sensor.');

  console.info(
    '%c BHYVE-CARDS %c v' + CARD_VERSION + ' ',
    'color:#fff;background:#1D9E75;font-weight:700;padding:2px 5px;border-radius:3px 0 0 3px',
    'color:#1D9E75;background:#fff;font-weight:700;padding:2px 5px;border-radius:0 3px 3px 0;border:1px solid #1D9E75'
  );
})();
