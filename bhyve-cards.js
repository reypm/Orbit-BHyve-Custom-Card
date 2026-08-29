// =============================================================================
// B-hyve Cards for Home Assistant — v5.0.0
//   custom:bhyve-card  — one per B-hyve device: zone rows, status, programs
//                        and settings. Also renders B-hyve flood sensors.
//
// v5 merges the v3-v4 pair (bhyve-controller-card + bhyve-zone-card) into this
// single card. custom:bhyve-controller-card stays registered as an alias so a
// v4 dashboard keeps rendering; custom:bhyve-zone-card is gone.
//
// Design source: the v5b states of "BHyve Card Family v5.dc.html" (design
// project 9c531b4e). v5a, the reordered chip row, was not selected.
// Integration:   https://github.com/sebr/bhyve-home-assistant
// Repository:    https://github.com/reypm/Orbit-BHyve-Custom-Card
// =============================================================================

(function () {
  'use strict';

  const CARD_VERSION   = '5.0.0';
  const CARD           = 'bhyve-card';
  const CARD_ED        = 'bhyve-card-editor';
  // v4 and earlier shipped this name. Kept registered as an alias of the same
  // card so upgrading does not blank every dashboard that uses it.
  const LEGACY_CARD    = 'bhyve-controller-card';

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
    wifi:       'mdi:wifi',
    wifiOff:    'mdi:wifi-off',
    battery:    'mdi:battery',
    batteryLow: 'mdi:battery-alert',
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
    .btn ha-icon { --mdc-icon-size: 22px; }

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

    .chevron {
      width: 32px; height: 32px; border-radius: 50%; flex: 0 0 auto;
      display: flex; align-items: center; justify-content: center;
      background: var(--bh-shape);
    }
    .chevron ha-icon { --mdc-icon-size: 22px; color: var(--secondary-text-color); }

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

  const CARD_STYLES = `
    /* ── Hub dot ─────────────────────────────────────────────────────
       Hub status is a property of the device, so it rides on the device's own
       icon rather than costing a row or a chip. It is the only ambient
       indicator on the card: a second one and neither reads as a status light.
       The ring is the card background, which follows the theme. */
    .icon-wrap { position: relative; flex: 0 0 auto; }
    .hub-dot {
      position: absolute; right: -1px; bottom: -1px; display: block;
      width: 12px; height: 12px; border-radius: 50%;
      background: rgb(${RGB.green});
      box-shadow: 0 0 0 2px var(--ha-card-background, var(--card-background-color, #fff));
    }
    .hub-dot.off { background: rgb(${RGB.red}); }

    /* Several drawer sub-lines carry the sentence that makes the row mean
       something — "Earliest across all zones · Front Lawn", "Sets manual preset
       on every zone" — and none of them fits one 380px line beside a value or a
       stepper. Ellipsing eats the informative half, so these wrap. */
    .drawer .row .secondary.wrap { white-space: normal; }

    /* Status rows are read-only. The right edge carries the value as plain
       text: four rows with an empty column where their neighbours have
       switches read as controls that failed to load. */
    .stat-val {
      flex: 0 0 auto; padding-right: 4px;
      font-size: 14px; font-weight: 500; letter-spacing: .1px;
      color: var(--primary-text-color); font-variant-numeric: tabular-nums;
    }

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

    /* Disabled programs are a subsection, not a second fold: a count label with
       a hairline running to the right edge, and the off rows below it. The
       settings drawer is where you go to configure programs, so hiding half of
       them behind another tap inside a section you already opened would be one
       fold too many. */
    .sub-head { display: flex; align-items: center; gap: 8px; padding: 10px 6px 4px; }
    .sub-head b {
      font-size: 11.5px; font-weight: 500; letter-spacing: .06em;
      text-transform: uppercase; color: var(--secondary-text-color);
    }
    .sub-head i { flex: 1; height: 1px; background: var(--bh-divider); }
    /* Only the name steps back — the switch stays live. */
    .drawer .row.prog-off .primary { color: var(--secondary-text-color); }

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

  // ---------------------------------------------------------------------------
  // Formatting helpers
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

  // Resolve one entity registered to the same device as another — the flood
  // sensor's temperature, signal and battery readings. A name match wins;
  // failing that a lone candidate is taken, since a flood sensor is a
  // single-entity device with nothing to confuse it with.
  //
  // The v4 zone card needed a perZone flag here to stop a zone borrowing a
  // sibling zone's battery reading. v5 resolves every device-level entity
  // through resolveDevice instead, so that flag no longer has a caller.
  function pickSibling(candidates, entityId) {
    if (!candidates.length) return null;
    const tokens = objectId(entityId).split('_').filter(Boolean);
    const exact = tokens.length ? candidates.find(c => {
      const t = objectId(c).split('_').filter(Boolean);
      return tokens.every(x => t.includes(x));
    }) : null;
    return exact || (candidates.length === 1 ? candidates[0] : null);
  }

  // ---------------------------------------------------------------------------
  // Resolver — turn one device into the full set of related B-hyve entities.
  // Explicit config always wins over discovery.
  // ---------------------------------------------------------------------------
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
      // A device has one bridge, so unlike the zone card there is nothing to
      // match per zone here — the first _connected sensor is the hub.
      hub:           c.hub_entity          || one('_connected', 'binary_sensor'),
      signal:        c.signal_entity       || one('_signal_strength', 'sensor'),
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

  // "Mon, Wed, Fri · 06:00 · 10 min", or "Weather adjusted · soil 61%".
  function programSummary(hass, programEntityId, station) {
    const st = hass && hass.states ? hass.states[programEntityId] : null;
    if (!st) return '';
    const a = st.attributes || {};
    const parts = [];

    // A weather-adjusted program picks its own start times and durations, so
    // printing a fixed schedule for it would state something the device does
    // not follow. It reports what drives the decision instead.
    if (a.is_smart_program) {
      const soil = num(a.soil_moisture_level);
      return ['Weather adjusted', soil == null ? null : 'soil ' + Math.round(soil) + '%']
        .filter(Boolean).join(' · ');
    }

    const freq = a.frequency || {};
    if (Array.isArray(freq.days) && freq.days.length) {
      parts.push(freq.days.map(d => DAY_NAMES[d] || d).join(', '));
    } else if (freq.interval) {
      parts.push('Every ' + freq.interval + ' days');
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
  // The card
  // ---------------------------------------------------------------------------
  class BhyveCard extends BhyveBase {
    constructor() {
      super();
      // One open flag per accordion. Both start closed, so the card rests at
      // header + zone rows + two toggle rows.
      this._open        = { settings: false, programs: false };
      this._runtime     = null;
      this._toast       = null;
      this._presetLocal = false;   // true once the device rejected the preset
    }

    static getConfigElement() { return document.createElement(CARD_ED); }
    static getStubConfig() { return { show_actions: true }; }

    setConfig(config) {
      if (!config) throw new Error('[bhyve-card] Invalid configuration.');
      this._config = Object.assign({ show_actions: true, show_programs: true }, config);
      if (this._hass) this._render();
    }

    getCardSize() { return 6; }

    // Configured device, else the first discovered B-hyve device with zones.
    _deviceId() {
      if (this._config.device_id) return this._config.device_id;
      const first = this._zones(null)[0];
      if (first) return deviceIdOf(first);
      if (!_registry) return null;
      const withZones = _registry.entities.filter(e => e.entity_id.startsWith('valve.'));
      return withZones.length ? withZones[0].device_id : null;
    }

    // zones takes entity ids or { entity, name } objects. The object form
    // carries a per-zone display name, which is what the v4 zone card had as
    // its own name option — the only per-zone setting v5b still renders.
    _zones(dev) {
      const cfg = this._config.zones;
      if (Array.isArray(cfg) && cfg.length) {
        return cfg.map(z => (typeof z === 'string' ? z : z && z.entity)).filter(Boolean);
      }
      return dev ? dev.zones : [];
    }

    _zoneNameOverride(zoneId) {
      const cfg = this._config.zones;
      if (!Array.isArray(cfg)) return null;
      const hit = cfg.find(z => z && typeof z === 'object' && z.entity === zoneId);
      return (hit && hit.name) || null;
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

      // A flood sensor is its own B-hyve device with none of a controller's
      // parts, so pointing the card at one renders the flood layout instead.
      if (this._config.entity && isFloodEntity(this._hass, this._config.entity)) {
        this._renderFlood();
        return;
      }

      const deviceId = this._deviceId();
      const dev      = deviceId ? resolveDevice(this._hass, deviceId, this._config) : null;
      const zones    = this._zones(dev);

      if (!dev || !zones.length) {
        this.shadowRoot.innerHTML = `
          <style>${BASE_STYLES}${CARD_STYLES}</style>
          <ha-card>
              ${this._emptyHtml()}
          </ha-card>`;
        return;
      }

      const showActions  = this._config.show_actions !== false;
      // show_actions gates every control: Run/Stop, rain delay, run time and
      // the programs section. show_programs gates the programs section alone.
      // Neither reaches the Status rows.
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

      // Rendered in both drawer states — it is the whole of "hub status is
      // always visible" now that the summary chip row is gone.
      const hubOnline = dev.hub ? this._isOn(dev.hub) : null;
      const hubDot = hubOnline == null ? '' :
        `<span class="hub-dot${hubOnline ? '' : ' off'}"
               title="${hubOnline ? 'Hub online' : 'Hub offline'}"></span>`;

      this.shadowRoot.innerHTML = `
        <style>${BASE_STYLES}${CARD_STYLES}</style>
        <ha-card class="${anyFault ? 'accent-red' : ''}">
          <div class="row head">
            <div class="icon-wrap">
              ${shapeHtml(ICON.controller, accent, 'lg')}
              ${hubDot}
            </div>
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
          ${this._sections(dev, zones, showActions, showPrograms)}
        </ha-card>`;

      this._bind(dev, zones);
      this._syncTick(running.length > 0);
    }

    _zoneName(zoneId) {
      const st = this._st(zoneId);
      return this._zoneNameOverride(zoneId)
        || (st && (st.attributes.zone_name || st.attributes.friendly_name))
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

    // Next scheduled run for the controller as a whole, plus the zone it
    // belongs to. The device sensor supplies the time when it has one, but the
    // zone name only exists in the per-zone next_start_time attributes, so
    // those are scanned either way.
    _nextRun(dev, zones) {
      const soonest = zones
        .map(z => ({ z: z, d: new Date(this._attr(z, 'next_start_time') || '') }))
        .filter(x => !isNaN(x.d.getTime()) && x.d > new Date())
        .sort((a, b) => a.d - b.d)[0];

      const nextSt = this._st(dev.nextWatering);
      const text = (nextSt && !['unavailable', 'unknown', ''].includes(nextSt.state)
        ? relativeFuture(nextSt.state) : null)
        || (soonest ? relativeFuture(soonest.d) : null);

      return { text: text, zone: soonest ? this._zoneName(soonest.z) : null };
    }

    // Weekly volume comes from statistics helpers the user creates, so there is
    // nothing to discover. weekly_volume_entity takes either one device-level
    // helper or a per-zone list; a list covering fewer entities than the card
    // has zones is a partial total and says so, rather than passing a subset
    // off as the controller's whole water use.
    _weeklyTotal(dev, zones) {
      const cfg = dev.weeklyVolume;
      const ids = (Array.isArray(cfg) ? cfg : [cfg]).filter(Boolean);
      if (!ids.length) return null;

      let total = 0, counted = 0, unit = null;
      ids.forEach(id => {
        const v = num(this._st(id) && this._st(id).state);
        if (v == null) return;
        total += v;
        counted++;
        unit = unit || this._attr(id, 'unit_of_measurement');
      });
      if (!counted || total <= 0) return null;

      return {
        text: total.toFixed(1) + ' ' + (unit || 'gal'),
        // A single helper is the device total by definition; only an explicit
        // per-zone list can be missing zones.
        note: Array.isArray(cfg) && counted < zones.length
          ? counted + ' of ' + zones.length + ' zones'
          : 'All zones combined',
      };
    }

    // The four device-level facts that used to be the summary chip row, now
    // read-only rows at the top of the drawer. A row is omitted when its data
    // is missing, exactly as its chip was.
    _statusRows(dev, zones) {
      const rows = [];
      const row = (icon, rgb, title, note, value) => `
        <div class="row">
          ${shapeHtml(icon, rgb)}
          <div class="grow">
            <div class="primary">${esc(title)}</div>
            <div class="secondary wrap">${esc(note)}</div>
          </div>
          <span class="stat-val">${esc(value)}</span>
        </div>`;

      if (dev.hub) {
        const on   = this._isOn(dev.hub);
        const hSt  = this._st(dev.hub);
        const sig  = num(this._st(dev.signal) && this._st(dev.signal).state);
        const seen = hSt ? fmtTime(new Date(hSt.last_changed)) : null;
        // Signal strength is not exposed by every device — drop that half of
        // the line rather than showing a placeholder for it.
        const note = on
          ? ['Wi-Fi bridge', sig != null ? sig + ' dBm' : null].filter(Boolean).join(' · ')
          : ['Not reachable', seen ? 'last seen ' + seen : null].filter(Boolean).join(' · ');
        rows.push(row(on ? ICON.wifi : ICON.wifiOff, on ? RGB.green : RGB.red,
                      'Hub', note, on ? 'Online' : 'Offline'));
      }

      const battery = num(this._st(dev.battery) && this._st(dev.battery).state);
      if (battery != null) {
        const low = battery <= 20;
        // The integration reports a level and nothing else — no charging state
        // to describe, so the sub-line only names what the level belongs to.
        rows.push(row(batteryIcon(battery), low ? RGB.orange : RGB.green,
                      'Battery', 'Controller', Math.round(battery) + '%'));
      }

      const next = this._nextRun(dev, zones);
      if (next.text) {
        rows.push(row(ICON.clock, RGB.grey, 'Next run',
          ['Earliest across all zones', next.zone].filter(Boolean).join(' · '),
          next.text));
      }

      const week = this._weeklyTotal(dev, zones);
      if (week) rows.push(row(ICON.chart, RGB.grey, 'This week', week.note, week.text));

      return rows;
    }

    // Two accordions, stacked below the zone rows, each with its own chevron
    // and its own open state.
    //
    // The split follows the read-only/actionable seam the Status section
    // introduced, and it fixes what made one combined drawer awkward: opening
    // it to nudge run time meant scrolling past every program first.
    //
    // Neither show_actions nor show_programs can hide the Status rows. Both are
    // about controls, and read-only device health is not a control — hiding a
    // control must never take device health with it. Only an option written
    // specifically for Status could, and there is none.
    _sections(dev, zones, showActions, showPrograms) {
      const out = [];

      const status  = this._statusRows(dev, zones);
      const rain    = showActions ? this._rainRow(dev) : '';
      const runtime = showActions ? this._runtimeRow(zones) : '';

      if (status.length || rain) {
        const hint = [status.length ? 'Status' : null, rain ? 'rain delay' : null,
                      runtime ? 'run time' : null].filter(Boolean).join(' · ');
        const statusHtml = status.length ? `
          <div class="drawer-title">
            <b>Status · all zones</b>
            <span>Read-only. One row per device-level fact — nothing here is
            per zone.</span>
          </div>
          ${status.join('')}
          ${rain ? '<div class="hr"></div>' : ''}` : '';
        out.push(this._section('settings', ICON.tune, 'settings &amp; configuration',
                               hint, statusHtml + rain + runtime));
      }

      const ids = showActions && showPrograms ? (dev.programs || []) : [];
      if (ids.length) {
        const on  = ids.filter(id => this._isOn(id));
        const off = ids.filter(id => !this._isOn(id));
        const body = `
          <div class="drawer-title">
            <b>Programs · all zones</b>
            <span>Every program on this controller, merged — programs are
            device-level, not per zone.</span>
          </div>
          ${on.map(id => this._programRow(id, true)).join('')}
          ${off.length ? `
          <div class="sub-head">
            <b>${off.length} disabled program${off.length === 1 ? '' : 's'}</b>
            <i></i>
          </div>
          ${off.map(id => this._programRow(id, false)).join('')}` : ''}`;
        out.push(this._section('programs', ICON.calendar, 'programs · all zones',
                               on.length + ' enabled · ' + off.length + ' disabled', body));
      }

      return out.join('');
    }

    // `label` carries markup (the &amp; in "settings & configuration"), so it is
    // interpolated raw — every caller is a literal in this file.
    _section(id, icon, label, hint, body) {
      const open = !!this._open[id];
      return `
        <button class="drawer-btn${open ? ' open' : ''}" data-act="section"
                data-section="${id}">
          <ha-icon icon="${icon}"></ha-icon>
          <span class="label">
            <b>${open ? 'Hide' : 'Show'} ${label}</b>
            ${hint ? `<span>${esc(hint)}</span>` : ''}
          </span>
          <span class="chevron"><ha-icon icon="${open ? ICON.up : ICON.down}"></ha-icon></span>
        </button>` +
        (open ? `<div class="drawer">${body}</div>` : '');
    }

    // Enabled and disabled rows are the same row; only the name colour differs.
    // The switch is live either way — this is not the zone card's
    // single-selection list, programs here are independent.
    _programRow(pid, enabled) {
      const icon = programIcon(this._hass, pid);
      const rgb  = enabled ? (icon === ICON.smart ? RGB.purple : RGB.accent) : RGB.grey;
      return `
        <div class="row${enabled ? '' : ' prog-off'}">
          ${shapeHtml(icon, rgb)}
          <div class="grow">
            <div class="primary">${esc(programName(this._hass, pid))}</div>
            <div class="secondary">${esc(programSummary(this._hass, pid, null))}</div>
          </div>
          ${swHtml(enabled, icon === ICON.smart,
                   `data-act="toggle" data-entity="${esc(pid)}"`)}
        </div>`;
    }

    _rainRow(dev) {
      if (!dev.rainDelay) return '';
      const on    = this._isOn(dev.rainDelay);
      const hours = rainDelayHours(this._hass, dev.rainDelay);
      const cause = this._attr(dev.rainDelay, 'cause')
        || this._attr(dev.rainDelay, 'weather_type');
      const detail = on
        ? ['Active', hours ? hours + ' h remaining' : null, cause].filter(Boolean).join(' · ')
        : 'Off';
      return `
          <div class="row">
            ${shapeHtml(ICON.rain, on ? RGB.accent : RGB.grey)}
            <div class="grow">
              <div class="primary">Rain delay</div>
              <div class="secondary wrap">${esc(detail)}</div>
            </div>
            ${swHtml(on, false, 'data-act="rain"')}
          </div>`;
    }

    _runtimeRow(zones) {
      const minutes = this._presetMinutes(zones);
      return `
          <div class="row">
            ${shapeHtml(ICON.timer, RGB.accent)}
            <div class="grow">
              <div class="primary">Run time</div>
              <div class="secondary wrap">Sets manual preset on every zone</div>
            </div>
            <div class="stepper">
              <button data-act="runtime" data-delta="-5" title="Less">
                <ha-icon icon="${ICON.minus}"></ha-icon></button>
              <span class="val">${Math.round(minutes)} min</span>
              <button data-act="runtime" data-delta="5" title="More">
                <ha-icon icon="${ICON.plus}"></ha-icon></button>
            </div>
          </div>`;
    }

    _renderFlood() {
      const c    = this._config;
      const st   = this._st(c.entity);
      const wet  = !!st && st.state === 'on';
      const sib  = siblingsOf(c.entity).map(e => e.entity_id);
      const pick = (suffix, domain) =>
        pickSibling(sib.filter(id => matches(id, domain, suffix)), c.entity);

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
        <style>${BASE_STYLES}${CARD_STYLES}</style>
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

      console.debug('[bhyve-card] set_manual_preset_runtime',
                    { entity_id: zones, minutes: next });

      const failed = reason => {
        this._presetLocal = true;
        this._toast = 'Device didn\u2019t accept this — using ' + next +
                      ' min as a local default only.';
        console.debug('[bhyve-card] preset rejected, keeping local default',
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
          else if (act === 'section') {
            const id = el.dataset.section;
            this._open[id] = !this._open[id];
            this._render();
          }
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
  const LABELS = {
    title:        'Title (defaults to the device name)',
    device_id:    'B-hyve device',
    entity:       'Flood sensor (leave empty for a controller)',
    show_actions: 'Show Run/Stop, rain delay and run time',
    show_programs: 'Show the programs section',
    run_time:     'Run time (minutes)',
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

  class BhyveCardEditor extends BhyveEditorBase {
    _schema() {
      return [
        { name: 'title',         selector: { text: {} } },
        { name: 'device_id',     selector: { device: { integration: 'bhyve' } } },
        { name: 'run_time',      selector: { number: { min: 1, max: 60, mode: 'box',
                                                       unit_of_measurement: 'min' } } },
        { name: 'show_actions',  selector: { boolean: {} } },
        { name: 'show_programs', selector: { boolean: {} } },
      ];
    }
    _hint() {
      return 'Leave the device empty to use the first B-hyve controller found, ' +
             'or set <code>entity</code> to a flood sensor. Entity overrides ' +
             '(<code>device_mode_entity</code>, <code>rain_delay_entity</code>, ' +
             '<code>hub_entity</code>, <code>signal_entity</code>, ' +
             '<code>weekly_volume_entity</code>, <code>zones</code>) are ' +
             'YAML-only for now.';
    }
  }

  // ---------------------------------------------------------------------------
  // Register
  // ---------------------------------------------------------------------------
  if (!customElements.get(CARD))    customElements.define(CARD,    BhyveCard);
  if (!customElements.get(CARD_ED)) customElements.define(CARD_ED, BhyveCardEditor);
  // Same card under the v4 name. A custom element cannot be registered twice,
  // so the alias is a bare subclass. It is deliberately absent from
  // window.customCards: the picker offers one card, not two.
  if (!customElements.get(LEGACY_CARD)) {
    customElements.define(LEGACY_CARD, class extends BhyveCard {});
  }

  window.customCards = window.customCards || [];
  const register = (type, name, description) => {
    if (!window.customCards.find(c => c.type === type)) {
      window.customCards.push({
        type, name, description, preview: true,
        documentationURL: 'https://github.com/reypm/Orbit-BHyve-Custom-Card',
      });
    }
  };
  register(CARD, 'B-hyve Card',
    'One per B-hyve device: zone rows, status, programs and settings. ' +
    'Also renders B-hyve flood sensors.');

  console.info(
    '%c BHYVE-CARDS %c v' + CARD_VERSION + ' ',
    'color:#fff;background:#1D9E75;font-weight:700;padding:2px 5px;border-radius:3px 0 0 3px',
    'color:#1D9E75;background:#fff;font-weight:700;padding:2px 5px;border-radius:0 3px 3px 0;border:1px solid #1D9E75'
  );
})();
