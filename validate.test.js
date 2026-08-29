// Headless validation for the v3 two-card family.
// Stubs just enough browser surface to render both cards and dispatch clicks.
'use strict';
const fs = require('fs');
const path = require('path');
const code = fs.readFileSync(path.join(__dirname, 'bhyve-cards.js'), 'utf8');

// ── Minimal DOM ────────────────────────────────────────────────────────────
// innerHTML is parsed just far enough to hand back clickable stand-ins for the
// tags the cards bind to, so event handlers run for real in these tests.
function parseTags(html) {
  const out = [];
  const re = /<(button|div|span|a)\b([^>]*)>/g;
  let m;
  while ((m = re.exec(html))) {
    const attrs = m[2];
    const el = {
      tag: m[1],
      dataset: {},
      classes: (/class="([^"]*)"/.exec(attrs) || [, ''])[1].split(/\s+/).filter(Boolean),
      disabled: /\sdisabled(\s|>|$)/.test(attrs + ' '),
      _handlers: [],
      addEventListener(type, fn) { if (type === 'click') this._handlers.push(fn); },
      click() { this._handlers.forEach(fn => fn({ stopPropagation() {} })); },
    };
    let a;
    const are = /data-([a-z-]+)="([^"]*)"/g;
    while ((a = are.exec(attrs))) {
      const key = a[1].replace(/-([a-z])/g, (_, ch) => ch.toUpperCase());
      el.dataset[key] = a[2];
    }
    out.push(el);
  }
  return out;
}

function makeShadow() {
  const shadow = {
    _html: '',
    _tags: [],
    get innerHTML() { return this._html; },
    set innerHTML(v) { this._html = v; this._tags = parseTags(v); },
    appendChild(el) { this._children.push(el); return el; },
    _children: [],
    querySelectorAll(sel) {
      if (sel === '[data-act]') return this._tags.filter(t => Object.keys(t.dataset).includes('act'));
      if (sel.startsWith('.')) return this._tags.filter(t => t.classes.includes(sel.slice(1)));
      return [];
    },
    querySelector(sel) { return this.querySelectorAll(sel)[0] || null; },
    getElementById() { return null; },
  };
  return shadow;
}

global.window = { customCards: [] };
global.CustomEvent = class { constructor(n, o) { this.type = n; this.detail = o && o.detail; } };
global.HTMLElement = class {
  constructor() { this._shadow = makeShadow(); }
  attachShadow() { return this._shadow; }
  get shadowRoot() { return this._shadow; }
  addEventListener() {}
  dispatchEvent(e) { (this._events = this._events || []).push(e); return true; }
};
global.customElements = {
  _reg: {},
  get(n) { return this._reg[n] || null; },
  define(n, cls) { this._reg[n] = cls; },
  whenDefined() { return Promise.resolve(); },
};
global.document = {
  documentElement: {},
  createElement: tag => ({ tag, addEventListener() {}, appendChild() {} }),
};
// Register a stand-in ha-form. Without one the editors take their "loading"
// path, and the stubbed whenDefined() resolves instantly, so _render() would
// re-enter itself forever and starve the event loop at the next await.
customElements.define('ha-form', class HaFormStub {});
// Pretend Mushroom is installed so the dependency notice stays out of the way.
global.getComputedStyle = () => ({ getPropertyValue: () => ' 33, 150, 243 ' });
const debugLog = [];
global.console = {
  info: () => {}, log: () => {},
  debug: (...a) => { debugLog.push(a); },
  error: (...a) => process.stderr.write('[ERR] ' + a.join(' ') + '\n'),
};

eval(code); // eslint-disable-line no-eval

// ── Runner ─────────────────────────────────────────────────────────────────
let passed = 0, failed = 0;
const errors = [];
function assert(cond, msg) {
  if (cond) { process.stdout.write('  PASS  ' + msg + '\n'); passed++; }
  else { process.stdout.write('  FAIL  ' + msg + '\n'); errors.push(msg); failed++; }
}
function group(name) { process.stdout.write('\n[' + name + ']\n'); }

// ── Fixtures ───────────────────────────────────────────────────────────────
const DEV1 = 'dev-controller', DEV2 = 'dev-flood';
const REG_ENTITIES = [
  ['valve.front_lawn', DEV1], ['valve.garden_beds', DEV1],
  ['valve.side_strip', DEV1], ['valve.back_lawn', DEV1],
  ['binary_sensor.front_lawn_connected', DEV1], ['binary_sensor.garden_beds_connected', DEV1],
  ['binary_sensor.side_strip_connected', DEV1], ['binary_sensor.back_lawn_connected', DEV1],
  ['sensor.front_lawn_battery_level', DEV1], ['sensor.garden_beds_battery_level', DEV1],
  ['sensor.side_strip_battery_level', DEV1],
  ['sensor.front_lawn_zone_history', DEV1], ['sensor.garden_beds_zone_history', DEV1],
  ['sensor.side_strip_zone_history', DEV1],
  ['binary_sensor.bhyve_xr_fault', DEV1], ['switch.bhyve_xr_rain_delay', DEV1],
  ['switch.front_lawn_smart_watering', DEV1],
  ['switch.bhyve_xr_a_program', DEV1], ['switch.bhyve_xr_b_program', DEV1],
  ['switch.bhyve_xr_e_program', DEV1],
  ['select.bhyve_xr_device_mode', DEV1], ['sensor.bhyve_xr_next_watering', DEV1],
  ['binary_sensor.basement_flood_sensor', DEV2], ['sensor.basement_temperature', DEV2],
  ['sensor.basement_signal_strength', DEV2], ['sensor.basement_battery_level', DEV2],
].map(([entity_id, device_id]) => ({ entity_id, device_id, platform: 'bhyve' }));

const REG_DEVICES = [
  { id: DEV1, name: 'Front Yard', name_by_user: null, model: 'B-hyve XR' },
  { id: DEV2, name: 'Basement', name_by_user: null, model: 'Flood Sensor' },
];

const NOW = Date.now();
const future = new Date(NOW + 36e5).toISOString();
const st = (state, attributes, extra) =>
  Object.assign({ state, attributes: attributes || {},
                  last_changed: new Date(NOW).toISOString() }, extra || {});

function baseStates() {
  return {
    'valve.front_lawn': st('open', {
      station: 1, zone_name: 'Front Lawn', manual_preset_runtime: 600,
      started_watering_station_at: new Date(NOW - 60000).toISOString(),
      next_start_time: future,
    }),
    'valve.garden_beds': st('closed', { station: 2, zone_name: 'Garden Beds', next_start_time: future }),
    'valve.side_strip':  st('closed', { station: 3, zone_name: 'Side Strip', next_start_time: future }),
    'valve.back_lawn':   st('unavailable', { station: 4, zone_name: 'Back Lawn' },
                            { last_changed: new Date(NOW - 3 * 86400000).toISOString() }),

    'binary_sensor.front_lawn_connected':  st('on'),
    'binary_sensor.garden_beds_connected': st('off'),
    'binary_sensor.side_strip_connected':  st('on'),
    'binary_sensor.back_lawn_connected':   st('off'),

    'sensor.front_lawn_battery_level':  st('85'),
    'sensor.garden_beds_battery_level': st('72'),
    'sensor.side_strip_battery_level':  st('18'),

    'sensor.front_lawn_zone_history':  st('ok', { run_time: 12, consumption_gallons: 18.4 }),
    'sensor.garden_beds_zone_history': st('ok', { run_time: 8,  consumption_gallons: 11.2 }),
    'sensor.side_strip_zone_history':  st('ok', { run_time: 3,  consumption_gallons: 2.1 }),

    'binary_sensor.bhyve_xr_fault': st('on', {
      station_faults: [{ station: 3, fault: 'short_circuit' }] }),
    'switch.bhyve_xr_rain_delay':      st('off', { delay: 48, cause: 'wind' }),
    'switch.front_lawn_smart_watering': st('on', { soil_moisture_level: 61 }),

    'switch.bhyve_xr_a_program': st('on', {
      friendly_name: 'Program A', frequency: { days: [1, 3, 5] }, start_times: ['06:00'],
      run_times: [{ station: 1, run_time: 10 }, { station: 2, run_time: 8 }] }),
    'switch.bhyve_xr_b_program': st('off', {
      friendly_name: 'Program B', frequency: { interval: 4 }, start_times: ['04:15'],
      run_times: [{ station: 2, run_time: 25 }] }),
    'switch.bhyve_xr_e_program': st('on', {
      friendly_name: 'Program E', is_smart_program: true,
      run_times: [{ station: 1, run_time: 12 }] }),

    'select.bhyve_xr_device_mode':   st('auto', { options: ['auto', 'off'] }),
    'sensor.bhyve_xr_next_watering': st(future, { programs: ['a'] }),

    'binary_sensor.basement_flood_sensor': st('off', { device_class: 'moisture' }),
    'sensor.basement_temperature':         st('68', { unit_of_measurement: '°F' }),
    'sensor.basement_signal_strength':     st('-63'),
    'sensor.basement_battery_level':       st('92'),
  };
}

const SERVICES = {
  bhyve: {
    start_watering: {}, stop_watering: {}, enable_rain_delay: {},
    disable_rain_delay: {}, set_manual_preset_runtime: {},
  },
  select: { select_option: {} },
  homeassistant: { turn_on: {}, turn_off: {} },
  valve: { open_valve: {}, close_valve: {} },
};

function makeHass(opts) {
  const o = opts || {};
  const calls = [];
  return {
    calls,
    states: o.states || baseStates(),
    services: o.services === undefined ? SERVICES : o.services,
    callService(domain, service, data) {
      calls.push({ domain, service, data });
      return o.rejectService ? Promise.reject(new Error('not supported')) : Promise.resolve();
    },
    callWS(msg) {
      return Promise.resolve(
        msg.type === 'config/entity_registry/list' ? REG_ENTITIES : REG_DEVICES);
    },
  };
}

const flush = () => new Promise(r => setTimeout(r, 0));
const RGB_RED_HINT = 'banner red';

// Markup with the inline <style> block stripped — class-name assertions must
// test what was rendered, not the stylesheet that ships alongside it.
function body(html) { return html.replace(/<style>[\s\S]*?<\/style>/g, ''); }

// Chip labels, in render order.
function chipLabels(html) {
  const out = [];
  const re = /<div class="chip"[^>]*>[\s\S]*?<span>([\s\S]*?)<\/span>/g;
  let m;
  while ((m = re.exec(html))) out.push(m[1]);
  return out;
}
function chipIcons(html) {
  const out = [];
  const re = /<div class="chip"[^>]*>\s*<ha-icon icon="([^"]+)"/g;
  let m;
  while ((m = re.exec(html))) out.push(m[1]);
  return out;
}

async function mountZone(config, hass) {
  const Card = customElements.get('bhyve-zone-card');
  const card = new Card();
  card.setConfig(config);
  card.hass = hass || makeHass();
  await flush();
  card._render();
  return card;
}

async function mountController(config, hass) {
  const Card = customElements.get('bhyve-controller-card');
  const card = new Card();
  card.setConfig(config || {});
  card.hass = hass || makeHass();
  await flush();
  card._render();
  return card;
}

// ── Tests ──────────────────────────────────────────────────────────────────
async function main() {
  group('1. Registration');
  const Controller = customElements.get('bhyve-controller-card');
  const Zone       = customElements.get('bhyve-zone-card');
  assert(!!Controller, 'bhyve-controller-card registered');
  assert(!!Zone, 'bhyve-zone-card registered');
  assert(!!customElements.get('bhyve-controller-card-editor'), 'controller editor registered');
  assert(!!customElements.get('bhyve-zone-card-editor'), 'zone editor registered');
  assert(window.customCards.length === 2, 'two customCards entries');
  assert(window.customCards.every(c => c.preview === true), 'both marked preview');
  // Keep the shipped version in step with the release tag.
  const EXPECTED_VERSION = '4.1.0';
  assert(code.indexOf("CARD_VERSION   = '" + EXPECTED_VERSION + "'") !== -1,
         'version constant is ' + EXPECTED_VERSION);

  group('2. setConfig');
  try { new Zone().setConfig({}); assert(false, 'zone card should require entity'); }
  catch (e) { assert(/entity/.test(e.message), 'zone card throws without entity'); }
  const ctrl0 = new Controller();
  ctrl0.setConfig({});
  assert(ctrl0._config.show_actions === true, 'controller defaults show_actions true');
  const zone0 = new Zone();
  zone0.setConfig({ entity: 'valve.front_lawn' });
  assert(zone0._config.run_time === 10, 'zone defaults run_time 10');

  group('3. Zone card — idle');
  const idle = await mountZone({ entity: 'valve.garden_beds' });
  let html = idle.shadowRoot.innerHTML;
  assert(html.indexOf('Idle · station 2') !== -1, 'idle shows "Idle · station N"');
  assert(html.indexOf('Run 10 min') !== -1, 'idle Run button shows preset minutes');
  assert(html.indexOf('mdi:play') !== -1, 'idle uses play icon');
  assert(html.indexOf('class="bar"') === -1, 'idle has no progress bar');
  assert(body(html).indexOf('accent-red') === -1, 'idle card is not red-accented');
  assert(html.indexOf('data-act="drawer"') === -1, 'idle zone card has no expander');
  // Garden Beds is station 2, which programs A and B both target. A is on, so
  // v4 shows only A inline and folds B away.
  assert(html.indexOf('class="rows"') !== -1, 'idle zone renders its program section');
  // Garden Beds has no smart-watering switch of its own, so that button is not
  // rendered at all rather than rendered disabled.
  assert(html.indexOf('data-act="smart"') === -1, 'quick action omitted when no backing entity');
  // Match the attribute form only — "1 disabled program" is legitimate copy now.
  assert(!/\sdisabled>/.test(body(html)),
         'no disabled placeholder button is left behind');
  assert(html.indexOf('data-act="rain"') !== -1, 'quick action kept when its entity resolves');
  assert(html.indexOf('Program A') !== -1, 'the enabled program renders inline');
  assert(html.indexOf('Program B') === -1, 'disabled programs are folded away by default');
  assert(html.indexOf('1 disabled program<') !== -1, 'fold row summarises the rest');

  const bare = await mountZone({ entity: 'valve.garden_beds' }, makeHass({ states: (() => {
    const s = baseStates();
    s['valve.garden_beds'] = st('closed', { station: 9, zone_name: 'Garden Beds' });
    return s;
  })() }));
  assert(bare.shadowRoot.innerHTML.indexOf('No program enabled') !== -1,
         'a zone with no programs of its own says so rather than rendering nothing');

  group('4. Zone card — running');
  const running = await mountZone({ entity: 'valve.front_lawn' });
  html = running.shadowRoot.innerHTML;
  assert(/Watering · \d+:\d\d left/.test(html), 'running shows live countdown');
  assert(html.indexOf('data-act="stop"') !== -1, 'running shows Stop button');
  assert(html.indexOf('class="bar"') !== -1, 'running shows progress bar');
  assert(html.indexOf('Smart watering') !== -1, 'running renders smart watering row inline');
  assert(html.indexOf('data-act="smart"') !== -1, 'smart quick action rendered when resolved');
  assert(html.indexOf('data-act="rain"') !== -1, 'rain quick action rendered when resolved');
  assert(html.indexOf('Soil moisture 61%') !== -1, 'smart watering row shows soil moisture');
  assert(html.indexOf('class="rows"') !== -1, 'collapsed content renders inline, no expander');
  assert(html.indexOf('data-act="drawer"') === -1, 'zone card has no drawer toggle');
  assert(running._tick !== null, 'running starts the 1s tick');
  running.disconnectedCallback();
  assert(running._tick === null, 'tick cleared on disconnect');

  group('5. Zone card — fault');
  const fault = await mountZone({ entity: 'valve.side_strip' });
  html = fault.shadowRoot.innerHTML;
  assert(html.indexOf('accent-red') !== -1, 'fault card is red-accented');
  assert(html.indexOf('Fault · will not run') !== -1, 'fault subtitle');
  assert(html.indexOf('class="banner red"') !== -1, 'fault renders warning banner');
  assert(html.indexOf('reports a short circuit') !== -1, 'fault copy carries the article');
  assert(html.indexOf('reports short circuit') === -1, 'no article-less fault copy');
  assert(html.indexOf('Station 3') !== -1, 'banner names the faulted station');
  assert(html.indexOf('Run blocked') !== -1, 'Run replaced by "Run blocked"');
  assert(html.indexOf('mdi:cancel') !== -1, 'blocked button uses no-entry icon');
  assert(html.indexOf('disabled') !== -1, 'blocked button is disabled');
  assert(html.indexOf('data-act="run"') === -1, 'no run action in fault state');
  assert(chipLabels(html).length >= 4, 'chip row still shown in fault state');

  group('6. Zone card — unavailable');
  const un = await mountZone({ entity: 'valve.back_lawn' });
  html = un.shadowRoot.innerHTML;
  assert(html.indexOf('Unavailable · entity not reporting') !== -1, 'unavailable subtitle');
  assert(html.indexOf('mdi:help-circle-outline') !== -1, 'unavailable uses "?" icon');
  assert(html.indexOf('class="btn') === -1, 'unavailable renders no action button at all');
  assert(body(html).indexOf('icon-btn') === -1, 'unavailable renders no quick-action buttons');
  const unChips = chipLabels(html);
  assert(unChips.length === 2, 'unavailable shows exactly two chips');
  assert(unChips[0] === 'Hub offline', 'first chip is hub offline');
  assert(/^Last seen 3 d ago$/.test(unChips[1]), 'second chip is "Last seen 3 d ago"');

  group('7. Fixed chip order');
  const ordered = await mountZone({
    entity: 'valve.front_lawn', weekly_volume_entity: 'sensor.week' },
    makeHass({ states: Object.assign(baseStates(), { 'sensor.week': st('48.6') }) }));
  const labels = chipLabels(ordered.shadowRoot.innerHTML);
  const icons  = chipIcons(ordered.shadowRoot.innerHTML);
  assert(labels[0] === 'Hub online', 'slot 1 = hub');
  assert(labels[1] === '85%', 'slot 2 = battery');
  assert(labels[2] === '12 min', 'slot 3 = last-run duration');
  assert(labels[3] === '18.4 gal', 'slot 4 = last-run volume');
  assert(labels[4] === '48.6 gal', 'slot 5 = weekly volume');
  assert(/^(Today|Tomorrow|\w{3}) /.test(labels[5]), 'slot 6 = next run');
  assert(labels.length === 6, 'exactly six chips when all are available');
  assert(icons[0] === 'mdi:wifi', 'hub online uses wifi icon');

  group('8. Chip visibility rules');
  const noHistory = await mountZone({ entity: 'valve.front_lawn' },
    makeHass({ states: (() => {
      const s = baseStates();
      delete s['sensor.front_lawn_zone_history'].attributes.run_time;
      return s;
    })() }));
  const nh = chipLabels(noHistory.shadowRoot.innerHTML);
  assert(nh.indexOf('12 min') === -1, 'no last-run chip before the zone has run');
  assert(nh.indexOf('18.4 gal') === -1, 'volume chip hidden together with duration');

  const lowBat = await mountZone({ entity: 'valve.side_strip' });
  assert(lowBat.shadowRoot.innerHTML.indexOf('mdi:battery-alert') !== -1,
         'battery <= 20% uses battery-alert icon');
  assert(lowBat.shadowRoot.innerHTML.indexOf('255, 152, 0') !== -1,
         'low battery tinted amber, not red');

  const noBat = await mountZone({ entity: 'valve.back_lawn' });
  assert(chipLabels(noBat.shadowRoot.innerHTML).indexOf('72%') === -1,
         'zone without its own battery sensor does not borrow a sibling zone reading');

  group('9. Weekly volume never renders a zero');
  const zeroWeek = await mountZone({
    entity: 'valve.front_lawn', weekly_volume_entity: 'sensor.week' },
    makeHass({ states: Object.assign(baseStates(), { 'sensor.week': st('0') }) }));
  assert(chipLabels(zeroWeek.shadowRoot.innerHTML).indexOf('0.0 gal') === -1,
         'weekly volume of 0 renders no chip');
  const unavailWeek = await mountZone({
    entity: 'valve.front_lawn', weekly_volume_entity: 'sensor.week' },
    makeHass({ states: Object.assign(baseStates(), { 'sensor.week': st('unavailable') }) }));
  assert(chipLabels(unavailWeek.shadowRoot.innerHTML).length === 5,
         'unavailable weekly volume treated as not configured');
  const noWeek = await mountZone({ entity: 'valve.front_lawn' });
  assert(chipLabels(noWeek.shadowRoot.innerHTML).indexOf('this week') === -1,
         'weekly chip absent when not configured');

  group('10. Next run / rain delay share one slot');
  const noRain = await mountZone({ entity: 'valve.front_lawn' });
  let l = chipLabels(noRain.shadowRoot.innerHTML);
  assert(l.filter(x => /Delay/.test(x)).length === 0, 'no delay chip while rain delay is off');
  assert(l.filter(x => /^(Today|Tomorrow|\w{3}) \d/.test(x)).length === 1, 'next-run chip shown');

  const rainStates = baseStates();
  rainStates['switch.bhyve_xr_rain_delay'] = st('on', { delay: 48, cause: 'wind' });
  const withRain = await mountZone({ entity: 'valve.front_lawn' },
    makeHass({ states: rainStates }));
  l = chipLabels(withRain.shadowRoot.innerHTML);
  assert(l.indexOf('Delay 48 h') !== -1, 'rain delay chip shown when active');
  assert(l.filter(x => /^(Today|Tomorrow|\w{3}) \d/.test(x)).length === 0,
         'next-run chip replaced, not appended');
  assert(l.length === 5, 'chip count unchanged — same slot');

  group('11. Controller card');
  const ctrl = await mountController({});
  html = ctrl.shadowRoot.innerHTML;
  assert(html.indexOf('Front Yard') !== -1, 'uses the device name from the registry');
  assert(html.indexOf('B-hyve XR') !== -1, 'shows the model in the secondary line');
  assert(html.indexOf('data-act="mode"') !== -1, 'renders the Auto/Off segmented control');
  assert(html.indexOf('>Auto<') !== -1 && html.indexOf('>Off<') !== -1, 'both mode options visible');
  assert(html.indexOf('<select') === -1, 'mode control is not a dropdown');
  assert((html.match(/class="zone-row"/g) || []).length === 4, 'one compact row per zone');
  assert(html.indexOf('data-act="more-info"') !== -1, 'zone row name opens more-info');
  assert(html.indexOf('Fault detected') !== -1, 'status reflects the device fault');

  // Rows follow the controller's station numbering, not entity_id order.
  const rowOrder = (drawerHtml => {
    const out = []; const re = /data-act="more-info" data-entity="([^"]+)"/g; let m;
    while ((m = re.exec(drawerHtml))) out.push(m[1]);
    return out;
  })(html);
  assert(rowOrder.join(',') ===
    'valve.front_lawn,valve.garden_beds,valve.side_strip,valve.back_lawn',
    'zone rows sorted by station number, not alphabetically');
  assert(rowOrder[0] === 'valve.front_lawn', 'station 1 first (alphabetical would be back_lawn)');

  // Status counts running zones rather than naming one.
  const noFault = s => { s['binary_sensor.bhyve_xr_fault'] = st('off', { station_faults: [] }); };
  const one = await mountController({}, makeHass({ states: (() => {
    const x = baseStates(); noFault(x); return x; })() }));
  assert(one.shadowRoot.innerHTML.indexOf('1 zone watering') !== -1,
    'single running zone reads "1 zone watering"');
  const headStatus = h => {
    const m = /class="row head"[\s\S]*?<div class="secondary">([^<]*)</.exec(h);
    return m ? m[1] : '';
  };
  assert(headStatus(one.shadowRoot.innerHTML).indexOf('Front Lawn') === -1,
    'header status is not the running zone name');
  assert(/\d+ zones? watering$/.test(headStatus(one.shadowRoot.innerHTML)),
    'header status ends with the watering count');

  const two = await mountController({}, makeHass({ states: (() => {
    const x = baseStates(); noFault(x);
    x['valve.garden_beds'] = st('open', { station: 2, zone_name: 'Garden Beds',
      manual_preset_runtime: 600,
      started_watering_station_at: new Date(NOW - 60000).toISOString() });
    return x; })() }));
  assert(two.shadowRoot.innerHTML.indexOf('2 zones watering') !== -1,
    'two running zones read "2 zones watering"');

  group('11b. Controller — device Off');
  const offHass = makeHass({ states: (() => {
    const x = baseStates(); noFault(x);
    x['select.bhyve_xr_device_mode'] = st('off', { options: ['auto', 'off'] });
    x['valve.front_lawn'] = st('closed', { station: 1, zone_name: 'Front Lawn' });
    return x; })() });
  const offCard = await mountController({}, offHass);
  const offHtml = offCard.shadowRoot.innerHTML;
  assert(offHtml.indexOf('Controller is off') !== -1, 'off shows the orange banner');
  assert(offHtml.indexOf('class="banner orange"') !== -1, 'banner uses the orange treatment');
  assert((offHtml.match(/>Off</g) || []).length >= 2,
    'zone rows read "Off" while the device mode is off');
  assert(offHtml.indexOf('>Idle<') === -1, 'no zone row still reads "Idle" when off');

  group('12. Controller drawer toggle');
  const drawer = await mountController({});
  assert(drawer._expanded === false, 'drawer closed by default');
  assert(drawer.shadowRoot.innerHTML.indexOf('Show programs &amp; settings') !== -1,
         'closed drawer offers to show');
  assert(drawer.shadowRoot.innerHTML.indexOf('class="drawer"') === -1, 'drawer body not rendered');
  const handle = drawer.shadowRoot.querySelectorAll('[data-act]')
    .find(el => el.dataset.act === 'drawer');
  assert(!!handle, 'drawer handle is clickable');
  handle.click();
  assert(drawer._expanded === true, 'clicking the handle opens the drawer');
  html = drawer.shadowRoot.innerHTML;
  assert(html.indexOf('Hide programs &amp; settings') !== -1, 'open drawer offers to hide');
  assert(html.indexOf('class="drawer"') !== -1, 'drawer body rendered');
  assert(html.indexOf('Rain delay') !== -1, 'drawer has the rain delay row');
  assert(html.indexOf('Run time') !== -1, 'drawer has the run time stepper');
  drawer.shadowRoot.querySelectorAll('[data-act]')
    .find(el => el.dataset.act === 'drawer').click();
  assert(drawer._expanded === false, 'clicking again closes it');

  group('13. Merged all-zones programs list');
  const progs = await mountController({});
  progs._expanded = true;
  progs._render();
  html = progs.shadowRoot.innerHTML;
  assert(html.indexOf('Programs · all zones') !== -1, 'section titled "Programs · all zones"');
  assert(html.indexOf('Program A') !== -1, 'lists program A');
  assert(html.indexOf('Program B') !== -1, 'lists program B (runs on zone 2 only)');
  assert(html.indexOf('Program E') !== -1, 'lists program E');
  assert(html.indexOf('Mon, Wed, Fri · 06:00') !== -1, 'program shows day + time schedule');
  assert(html.indexOf('Every 4 days · 04:15') !== -1, 'interval schedule rendered');
  assert(html.indexOf('Every 4 days · 04:15 · 25 min') !== -1,
    'drawer program row includes its run time');
  assert(html.indexOf('Mon, Wed, Fri · 06:00 · 8\u201310 min') !== -1,
    'run time spanning zones shown as a range');
  assert(html.indexOf('Weather adjusted · 12 min') !== -1, 'smart program run time shown');
  assert(html.indexOf('mdi:brain') !== -1, 'smart program uses the brain icon');
  assert(html.indexOf('mdi:calendar-month') !== -1, 'ordinary program uses the calendar icon');
  assert(html.indexOf('3 programs · rain delay · run time') !== -1, 'drawer hint counts programs');
  const zoneScoped = await mountZone({ entity: 'valve.side_strip' });
  assert(zoneScoped.shadowRoot.innerHTML.indexOf('Program B') === -1,
         'zone card lists only programs that target its own station');

  group('14. Run time stepper');
  const okHass = makeHass();
  const stepper = await mountController({}, okHass);
  stepper._expanded = true; stepper._render();
  let plus = stepper.shadowRoot.querySelectorAll('[data-act]')
    .find(el => el.dataset.act === 'runtime' && el.dataset.delta === '5');
  plus.click();
  await flush();
  assert(stepper._runtime === 15, 'stepper raises the value by 5');
  const presetCall = okHass.calls.find(c => c.service === 'set_manual_preset_runtime');
  assert(!!presetCall, 'calls bhyve.set_manual_preset_runtime');
  assert(Array.isArray(presetCall.data.entity_id) && presetCall.data.entity_id.length === 4,
         'targets every zone valve on the controller');
  assert(presetCall.data.minutes === 15, 'sends the new minutes value');
  assert(stepper._presetLocal === false, 'accepted preset is not marked session-only');
  assert(stepper.shadowRoot.innerHTML.indexOf('class="toast"') === -1, 'no toast on success');

  group('15. Run time stepper — rejected service call');
  const badHass = makeHass({ rejectService: true });
  const fallback = await mountController({}, badHass);
  fallback._expanded = true; fallback._render();
  fallback.shadowRoot.querySelectorAll('[data-act]')
    .find(el => el.dataset.act === 'runtime' && el.dataset.delta === '5').click();
  await flush(); await flush();
  assert(fallback._runtime === 15, 'value kept as a session default after rejection');
  assert(fallback._presetLocal === true, 'marked session-only');
  html = fallback.shadowRoot.innerHTML;
  assert(html.indexOf('class="toast"') !== -1, 'surfaces an inline note');
  assert(html.indexOf('accept this') !== -1, 'note says the device refused the preset');
  assert(html.indexOf('15 min') !== -1, 'stepper still displays the new value');

  const noService = makeHass({ services: { homeassistant: { turn_on: {}, turn_off: {} } } });
  const noSvc = await mountController({}, noService);
  noSvc._expanded = true; noSvc._render();
  noSvc.shadowRoot.querySelectorAll('[data-act]')
    .find(el => el.dataset.act === 'runtime' && el.dataset.delta === '5').click();
  await flush();
  assert(noSvc._presetLocal === true, 'missing service also falls back to session-only');
  assert(noService.calls.length === 0, 'no service call attempted when unsupported');

  group('16. Zone card Run button is independent of the controller preset');
  const runHass = makeHass();
  const runCard = await mountZone({ entity: 'valve.garden_beds', run_time: 7 }, runHass);
  runCard.shadowRoot.querySelectorAll('[data-act]')
    .find(el => el.dataset.act === 'run').click();
  const runCall = runHass.calls.find(c => c.service === 'start_watering');
  assert(!!runCall, 'Run calls bhyve.start_watering');
  assert(runCall.data.minutes === 7, 'passes its own explicit minutes value');

  group('17. Mode + rain delay service calls');
  const modeHass = makeHass();
  const modeCard = await mountController({}, modeHass);
  modeCard.shadowRoot.querySelectorAll('[data-act]')
    .find(el => el.dataset.act === 'mode' && el.dataset.option === 'off').click();
  const modeCall = modeHass.calls.find(c => c.service === 'select_option');
  assert(!!modeCall, 'segmented control calls select.select_option');
  assert(modeCall.data.entity_id === 'select.bhyve_xr_device_mode', 'targets the device mode select');
  assert(modeCall.data.option === 'off', 'sends the chosen option');

  const rainHass = makeHass();
  const rainCard = await mountController({}, rainHass);
  rainCard._expanded = true; rainCard._render();
  rainCard.shadowRoot.querySelectorAll('[data-act]')
    .find(el => el.dataset.act === 'rain').click();
  const rainCall = rainHass.calls.find(c => c.service === 'enable_rain_delay');
  assert(!!rainCall, 'rain delay toggle calls bhyve.enable_rain_delay');
  assert(rainCall.data.hours === 24, 'defaults to 24 hours');

  group('18. Flood sensor');
  const dry = await mountZone({ entity: 'binary_sensor.basement_flood_sensor' });
  html = dry.shadowRoot.innerHTML;
  assert(html.indexOf('mdi:home-flood') !== -1, 'flood card uses the home icon');
  assert(html.indexOf('>Dry<') !== -1, 'dry state');
  assert(body(html).indexOf('accent-red') === -1, 'dry card is not red');
  assert(html.indexOf('Simulate') === -1, 'no Simulate button');
  assert(html.indexOf('auto shutoff') === -1, 'no auto-shutoff text');
  const floodChips = chipLabels(html);
  assert(floodChips.length === 3, 'temperature, signal and battery chips');
  assert(floodChips[0].indexOf('68') !== -1, 'temperature chip');
  assert(floodChips[1].indexOf('-63 dBm') !== -1, 'signal chip');
  assert(floodChips[2] === '92%', 'battery chip');

  const wetStates = baseStates();
  wetStates['binary_sensor.basement_flood_sensor'] = st('on', { device_class: 'moisture' });
  const wet = await mountZone({ entity: 'binary_sensor.basement_flood_sensor' },
    makeHass({ states: wetStates }));
  html = wet.shadowRoot.innerHTML;
  assert(html.indexOf('accent-red') !== -1, 'wet card is red-accented');
  assert(/Water detected · \d/.test(html), 'wet shows "Water detected · HH:MM"');

  group('19. Empty state');
  const emptyHass = makeHass({ states: {} });
  emptyHass.callWS = () => Promise.resolve([]);
  const EmptyCard = customElements.get('bhyve-controller-card');
  const empty = new EmptyCard();
  empty.setConfig({ device_id: 'nope' });
  empty.hass = emptyHass;
  await flush();
  empty._render();
  html = empty.shadowRoot.innerHTML;
  assert(html.indexOf('No B-hyve devices found') !== -1, 'empty heading');
  assert(html.indexOf('Add the Orbit B-hyve integration') !== -1, 'empty subtext');
  assert(html.indexOf('class="empty"') !== -1, 'centered empty layout');

  group('20. show_actions');
  const readOnly = await mountController({ show_actions: false });
  html = readOnly.shadowRoot.innerHTML;
  assert(html.indexOf('data-act="run"') === -1, 'no Run buttons when show_actions is false');
  assert(html.indexOf('data-act="runtime"') === -1, 'no run-time stepper either');
  assert(html.indexOf('data-act="drawer"') !== -1,
    'the drawer toggle stays — it is the way to the read-only Status section');
  assert(html.indexOf('Show status') !== -1,
    'and offers status, not settings it no longer has');
  assert(html.indexOf('data-act="mode"') !== -1, 'mode control stays — it is authoritative');

  group('21. XSS escaping');
  const nasty = baseStates();
  nasty['valve.garden_beds'] = st('closed',
    { station: 2, zone_name: '<img src=x onerror=alert(1)>' });
  const xss = await mountZone({ entity: 'valve.garden_beds' }, makeHass({ states: nasty }));
  html = xss.shadowRoot.innerHTML;
  assert(html.indexOf('<img src=x') === -1, 'zone name is escaped');
  assert(html.indexOf('&lt;img src=x') !== -1, 'escaped form present');
  const xssName = await mountZone({ entity: 'valve.garden_beds', name: '"><script>x</script>' },
    makeHass({ states: nasty }));
  assert(xssName.shadowRoot.innerHTML.indexOf('<script>') === -1, 'config name is escaped');
  const xssCtrl = await mountController({ title: '<b>bold</b>' });
  assert(xssCtrl.shadowRoot.innerHTML.indexOf('<b>bold</b>') === -1, 'controller title is escaped');

  group('22. Mushroom is a soft dependency, with no detection probe');
  // The probe used to read --mush-rgb-blue, which Mushroom only ever reads and
  // never sets, so the "not installed" banner fired for almost everyone.
  assert(code.indexOf('--mush-rgb-blue') === -1 || code.indexOf('getPropertyValue') === -1,
         'no getComputedStyle probe for --mush-rgb-blue remains');
  assert(code.indexOf('_mushroomMissing') === -1, '_mushroomMissing() removed');
  assert(code.indexOf('Mushroom is not installed') === -1, 'warning banner copy removed');
  assert(code.indexOf('dismiss-notice') === -1, 'dismiss handler removed');
  const realGCS = global.getComputedStyle;
  global.getComputedStyle = () => ({ getPropertyValue: () => '' });
  const noTokens = await mountZone({ entity: 'valve.garden_beds' });
  const noTokensHtml = noTokens.shadowRoot.innerHTML;
  assert(noTokensHtml.indexOf('Mushroom') === -1, 'nothing about Mushroom is rendered');
  assert(noTokensHtml.indexOf('Idle · station 2') !== -1,
         'card renders normally without the tokens');
  global.getComputedStyle = realGCS;
  // The fallbacks are Mushroom's own --default-* values, which is what makes the
  // probe unnecessary.
  [['blue','33, 150, 243'],['green','76, 175, 80'],['orange','255, 152, 0'],
   ['red','244, 67, 54'],['purple','146, 107, 199'],['grey','158, 158, 158']]
    .forEach(([name, rgb]) => assert(
      code.indexOf('var(--mush-rgb-' + name + ', ' + rgb + ')') !== -1,
      name + ' falls back to Mushroom\'s own default ' + rgb));

  group('24. manual_preset_runtime is seconds, not minutes');
  // Regression: the attribute was rendered and dispatched as if it were minutes,
  // so a 300 s preset showed "Run 300 min" and would have watered for 5 hours.
  const secHass = makeHass({ states: (() => {
    const x = baseStates();
    x['binary_sensor.bhyve_xr_fault'] = st('off', { station_faults: [] });
    x['valve.front_lawn']  = st('closed', { station: 1, zone_name: 'Front Lawn',
      manual_preset_runtime: 600, next_start_time: future });
    x['valve.garden_beds'] = st('closed', { station: 2, zone_name: 'Garden Beds',
      manual_preset_runtime: 300, next_start_time: future });
    return x; })() });

  const z300 = await mountZone({ entity: 'valve.garden_beds' }, secHass);
  const z600 = await mountZone({ entity: 'valve.front_lawn' }, secHass);
  const h300 = z300.shadowRoot.innerHTML, h600 = z600.shadowRoot.innerHTML;

  assert(h300.indexOf('Run 5 min') !== -1, '300 s preset renders "Run 5 min"');
  assert(h600.indexOf('Run 10 min') !== -1, '600 s preset renders "Run 10 min"');
  assert(h300.indexOf('Run 300 min') === -1, 'raw seconds never reach the label');
  assert(h600.indexOf('Run 600 min') === -1, 'raw seconds never reach the label (600)');

  // The label alone is not enough — a label-only fix would still water for hours.
  assert(/data-act="run" data-minutes="5"/.test(h300), '300 s dispatches minutes=5');
  assert(/data-act="run" data-minutes="10"/.test(h600), '600 s dispatches minutes=10');

  const runHass300 = makeHass({ states: secHass.states });
  const c300 = await mountZone({ entity: 'valve.garden_beds' }, runHass300);
  c300.shadowRoot.querySelectorAll('[data-act]').find(e => e.dataset.act === 'run').click();
  const call300 = runHass300.calls.find(c => c.service === 'start_watering');
  assert(!!call300, 'Run dispatches start_watering');
  assert(call300.data.minutes === 5, 'service actually receives 5, not 300');

  const runHass600 = makeHass({ states: secHass.states });
  const c600 = await mountZone({ entity: 'valve.front_lawn' }, runHass600);
  c600.shadowRoot.querySelectorAll('[data-act]').find(e => e.dataset.act === 'run').click();
  const call600 = runHass600.calls.find(c => c.service === 'start_watering');
  assert(call600.data.minutes === 10, 'service actually receives 10, not 600');

  // Same conversion on the controller's compact rows.
  const ctrlSec = await mountController({}, secHass);
  const ctrlHtml = ctrlSec.shadowRoot.innerHTML;
  assert(ctrlHtml.indexOf('>10m</button>') !== -1 || /data-minutes="10"/.test(ctrlHtml),
         'controller row shows 10m for a 600 s preset');
  assert(ctrlHtml.indexOf('300m') === -1 && ctrlHtml.indexOf('600m') === -1,
         'controller rows never show raw seconds');
  assert(/data-minutes="5"/.test(ctrlHtml), 'controller row dispatches 5 for a 300 s preset');

  // And on the live countdown, which would otherwise run 60x too long.
  const liveHass = makeHass({ states: (() => {
    const x = baseStates();
    x['valve.front_lawn'] = st('open', { station: 1, zone_name: 'Front Lawn',
      manual_preset_runtime: 600,
      started_watering_station_at: new Date(NOW - 60000).toISOString() });
    return x; })() });
  const live = await mountZone({ entity: 'valve.front_lawn' }, liveHass);
  const leftSec = live._remaining('valve.front_lawn', 10);
  assert(Math.abs(leftSec - 540) < 5,
         'countdown uses 600 s = 10 min, leaving ~540 s after one minute (got ' +
         Math.round(leftSec) + ')');
  assert(leftSec < 600, 'countdown is not 60x too long');

  group('25. Run-time stepper reports what it sent');
  debugLog.length = 0;
  const dbgHass = makeHass();
  const dbg = await mountController({}, dbgHass);
  dbg._expanded = true; dbg._render();
  dbg.shadowRoot.querySelectorAll('[data-act]')
    .find(e => e.dataset.act === 'runtime' && e.dataset.delta === '5').click();
  await flush();
  const sent = debugLog.find(a => String(a[0]).indexOf('set_manual_preset_runtime') !== -1);
  assert(!!sent, 'logs the service call for verification against the HA log');
  assert(Array.isArray(sent[1].entity_id) && sent[1].entity_id.length === 4,
         'logged payload targets every zone valve');
  assert(sent[1].minutes === 15, 'logged payload carries minutes, the service unit');

  // The reported symptom: the stepper looked inert because the rows preferred
  // the reported attribute, which the integration never refreshes in-session.
  assert(dbg.shadowRoot.innerHTML.indexOf('15 min') !== -1, 'stepper shows the new value');
  assert(/data-minutes="15"/.test(dbg.shadowRoot.innerHTML),
         'zone rows adopt the newly set run time immediately');
  assert(dbg.shadowRoot.innerHTML.indexOf('>10m<') === -1,
         'rows no longer fall back to the stale attribute after an explicit change');

  const rejHass = makeHass({ rejectService: true });
  const rej = await mountController({}, rejHass);
  rej._expanded = true; rej._render();
  rej.shadowRoot.querySelectorAll('[data-act]')
    .find(e => e.dataset.act === 'runtime' && e.dataset.delta === '5').click();
  await flush(); await flush();
  const rejHtml = rej.shadowRoot.innerHTML;
  assert(rejHtml.indexOf('accept this') !== -1,
         'rejection surfaces the visible fallback notice');
  assert(rejHtml.indexOf('class="toast"') !== -1, 'notice rendered as an inline toast');
  assert(rejHtml.indexOf('local default only') !== -1, 'notice says the value is local only');
  assert(rej._presetLocal === true, 'and the session-only flag is set');

  group('26. v4 program section — fold, neutral state, single selection');

  // Explicit program_entities bypass discovery, so each case gets exactly the
  // program set it needs.
  const P = n => 'switch.bhyve_xr_' + n + '_program';
  const progStates = (onLetter, letters) => {
    const x = baseStates();
    x['binary_sensor.bhyve_xr_fault'] = st('off', { station_faults: [] });
    x['valve.garden_beds'] = st('closed', { station: 2, zone_name: 'Garden Beds' });
    letters.forEach((L, i) => {
      x[P(L)] = st(L === onLetter ? 'on' : 'off', {
        friendly_name: 'Program ' + L.toUpperCase(),
        frequency: { days: [1, 3, 5] }, start_times: ['06:0' + i],
        run_times: [{ station: 2, run_time: 10 }],
      });
    });
    return x;
  };
  const EIGHT = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
  const mountProgs = (onLetter, letters, extra) => mountZone(
    Object.assign({ entity: 'valve.garden_beds',
                    program_entities: letters.map(P) }, extra || {}),
    makeHass({ states: progStates(onLetter, letters) }));

  // ── default collapsed ──────────────────────────────────────────────────
  const eight = await mountProgs('a', EIGHT);
  let h = eight.shadowRoot.innerHTML;
  assert(eight._programsOpen !== true, 'fold starts collapsed');
  assert(h.indexOf('Program A') !== -1, 'the enabled program is shown');
  assert(h.indexOf('Program B') === -1 && h.indexOf('Program H') === -1,
         'disabled programs are not in the DOM while collapsed');
  assert(h.indexOf('7 disabled programs') !== -1, 'fold counts the rest');
  assert(h.indexOf('Hide 7') === -1, 'collapsed copy has no "Hide" prefix');
  assert(h.indexOf('prog-on') !== -1, 'the enabled row carries the accent fill');
  assert(h.indexOf('mdi:chevron-down') !== -1, 'chevron points down when collapsed');
  // Three rows max by default: smart watering, the enabled program, the fold.
  assert((h.match(/class="row"/g) || []).length +
         (h.match(/class="row prog-on"/g) || []).length === 2,
         'only two program-area rows before the fold button');

  // ── expanding ──────────────────────────────────────────────────────────
  eight.shadowRoot.querySelectorAll('[data-act]')
    .find(e => e.dataset.act === 'programs-fold').click();
  h = eight.shadowRoot.innerHTML;
  assert(eight._programsOpen === true, 'fold opens on click');
  assert(h.indexOf('Hide 7 disabled programs') !== -1, 'expanded copy adds "Hide"');
  assert(h.indexOf('Program B') !== -1 && h.indexOf('Program H') !== -1,
         'every disabled program renders when expanded');
  assert(h.indexOf('mdi:chevron-up') !== -1, 'chevron flips when expanded');
  eight.shadowRoot.querySelectorAll('[data-act]')
    .find(e => e.dataset.act === 'programs-fold').click();
  assert(eight._programsOpen === false, 'clicking again collapses it');

  // ── singular copy ──────────────────────────────────────────────────────
  const twoProgs = await mountProgs('a', ['a', 'b']);
  assert(twoProgs.shadowRoot.innerHTML.indexOf('1 disabled program<') !== -1,
         'singular copy for one disabled program');
  assert(twoProgs.shadowRoot.innerHTML.indexOf('1 disabled programs') === -1,
         'no plural "s" on a count of one');
  twoProgs.shadowRoot.querySelectorAll('[data-act]')
    .find(e => e.dataset.act === 'programs-fold').click();
  assert(twoProgs.shadowRoot.innerHTML.indexOf('Hide 1 disabled program<') !== -1,
         'singular copy keeps the Hide prefix');

  // ── zero disabled — no fold row at all ─────────────────────────────────
  const oneProg = await mountProgs('a', ['a']);
  const oneHtml = oneProg.shadowRoot.innerHTML;
  assert(oneHtml.indexOf('disabled program') === -1, 'no "0 disabled programs" row');
  assert(oneHtml.indexOf('data-act="programs-fold"') === -1, 'fold row omitted entirely');
  assert(oneHtml.indexOf('Program A') !== -1, 'the enabled program still shows');

  // ── no program enabled ─────────────────────────────────────────────────
  const none = await mountProgs(null, ['a', 'b', 'c']);
  const noneHtml = none.shadowRoot.innerHTML;
  assert(noneHtml.indexOf('No program enabled') !== -1, 'neutral row rendered');
  assert(noneHtml.indexOf('This zone only waters when you run it manually') !== -1,
         'exact subtitle copy');
  assert(noneHtml.indexOf('mdi:calendar-remove') !== -1, 'event_busy-equivalent icon');
  assert(noneHtml.indexOf('3 disabled programs') !== -1,
         'fold counts every program when none is enabled');
  assert(body(noneHtml).indexOf('prog-on') === -1, 'no row carries the enabled fill');
  // The neutral row has no switch of its own.
  const noneRow = noneHtml.slice(noneHtml.indexOf('No program enabled'));
  assert(noneRow.slice(0, noneRow.indexOf('</div>\n          </div>')).indexOf('class="sw') === -1,
         'neutral row has no switch control');
  assert(body(noneHtml).indexOf(RGB_RED_HINT) === -1, 'neutral state is not warning-coloured');

  // ── single selection: exact service-call pairing ───────────────────────
  const selHass = makeHass({ states: progStates('a', ['a', 'b', 'c', 'd']) });
  const sel = await mountZone({ entity: 'valve.garden_beds',
    program_entities: ['a', 'b', 'c', 'd'].map(P) }, selHass);
  sel._programsOpen = true; sel._render();
  sel.shadowRoot.querySelectorAll('[data-act]')
    .find(e => e.dataset.act === 'program' && e.dataset.entity === P('c')).click();

  const calls = selHass.calls;
  const forEntity = id => calls.filter(c => c.data.entity_id === id);
  assert(forEntity(P('c')).length === 1, 'exactly one call touches Program C');
  assert(forEntity(P('c'))[0].domain === 'switch' &&
         forEntity(P('c'))[0].service === 'turn_on', 'Program C gets switch.turn_on');
  assert(forEntity(P('a')).length === 1, 'exactly one call touches Program A');
  assert(forEntity(P('a'))[0].domain === 'switch' &&
         forEntity(P('a'))[0].service === 'turn_off', 'Program A gets switch.turn_off');
  assert(forEntity(P('b')).length === 0, 'Program B is untouched');
  assert(forEntity(P('d')).length === 0, 'Program D is untouched');
  assert(calls.length === 2, 'exactly two service calls in total');

  // Optimistic, and rendered before either call could resolve.
  const selHtml = sel.shadowRoot.innerHTML;
  assert(sel._isOn(P('c')) === true, 'tapped program reads on immediately');
  assert(sel._isOn(P('a')) === false, 'outgoing program reads off immediately');
  assert(selHtml.indexOf('Program C') < selHtml.indexOf('disabled program'),
         'Program C has moved into the enabled slot above the fold');

  // ── tapping the enabled program turns it off and enables nothing ───────
  const offHass2 = makeHass({ states: progStates('a', ['a', 'b', 'c']) });
  const offSel = await mountZone({ entity: 'valve.garden_beds',
    program_entities: ['a', 'b', 'c'].map(P) }, offHass2);
  offSel.shadowRoot.querySelectorAll('[data-act]')
    .find(e => e.dataset.act === 'program' && e.dataset.entity === P('a')).click();
  assert(offHass2.calls.length === 1, 'a single call when switching the enabled one off');
  assert(offHass2.calls[0].service === 'turn_off' &&
         offHass2.calls[0].data.entity_id === P('a'), 'and it is turn_off on that program');
  assert(offHass2.calls.filter(c => c.service === 'turn_on').length === 0,
         'nothing is auto-enabled in its place');
  assert(offSel.shadowRoot.innerHTML.indexOf('No program enabled') !== -1,
         'the zone lands in the no-program state');

  // ── Smart watering is exempt on all three counts ───────────────────────
  const smartHass = makeHass({ states: (() => {
    const x = progStates('a', ['a', 'b', 'c']);
    x['switch.front_lawn_smart_watering'] = st('on', { soil_moisture_level: 61 });
    return x; })() });
  const smart = await mountZone({ entity: 'valve.front_lawn',
    program_entities: ['a', 'b', 'c'].map(P),
    smart_watering_entity: 'switch.front_lawn_smart_watering' }, smartHass);
  let sh = smart.shadowRoot.innerHTML;
  assert(sh.indexOf('Smart watering') !== -1, '(a) renders while the fold is collapsed');
  assert(sh.indexOf('2 disabled programs') !== -1,
         '(b) not counted among the disabled programs');
  smart.shadowRoot.querySelectorAll('[data-act]')
    .find(e => e.dataset.act === 'programs-fold').click();
  assert(smart.shadowRoot.innerHTML.indexOf('Smart watering') !== -1,
         '(a) still renders while expanded');
  smartHass.calls.length = 0;
  smart.shadowRoot.querySelectorAll('[data-act]')
    .find(e => e.dataset.act === 'toggle' &&
               e.dataset.entity === 'switch.front_lawn_smart_watering').click();
  assert(smartHass.calls.length === 1, '(c) tapping it makes exactly one call');
  assert(smartHass.calls[0].data.entity_id === 'switch.front_lawn_smart_watering',
         '(c) and only touches its own entity');
  assert(smartHass.calls.filter(c => String(c.data.entity_id).indexOf('_program') !== -1)
         .length === 0, '(c) no program entity is touched by the smart watering toggle');
  assert(smart._isOn(P('a')) === true, '(c) the enabled program is unaffected');

  group('27. show_programs — controller card');
  const drawerOn = await mountController({});
  const drawerOnHtml = drawerOn.shadowRoot.innerHTML;
  assert(drawerOn._config.show_programs === true, 'defaults to true');
  assert(drawerOnHtml.indexOf('data-act="drawer"') !== -1, 'drawer toggle rendered by default');
  assert(drawerOnHtml.indexOf('programs &amp; settings') !== -1, 'toggle row present by default');

  const drawerOff = await mountController({ show_programs: false });
  const offHtml2 = drawerOff.shadowRoot.innerHTML;
  // The whole drawer goes, its own show/hide row included.
  assert(offHtml2.indexOf('data-act="drawer"') !== -1,
    'toggle row stays — it still reaches Status');
  assert(offHtml2.indexOf('programs &amp; settings') === -1, 'show/hide copy gone');
  assert(offHtml2.indexOf('Show status') !== -1, 'replaced by copy naming what is left');
  assert(offHtml2.indexOf('class="drawer"') === -1, 'drawer body omitted');
  assert(offHtml2.indexOf('Programs · all zones') === -1, 'merged programs list omitted');
  assert(offHtml2.indexOf('Rain delay') === -1, 'rain delay row omitted');
  assert(offHtml2.indexOf('Run time') === -1, 'run time stepper omitted');
  assert(offHtml2.indexOf('data-act="runtime"') === -1, 'stepper controls not in the DOM');
  assert(body(offHtml2).indexOf('display: none') === -1 &&
         body(offHtml2).indexOf('hidden') === -1,
         'omitted from the DOM, not hidden with CSS');

  // Everything outside the drawer is untouched.
  assert(offHtml2.indexOf('data-act="mode"') !== -1, 'Auto/Off control unaffected');
  assert(offHtml2.indexOf('data-act="run"') !== -1, 'zone Run buttons unaffected');
  assert((offHtml2.match(/class="zone-row"/g) || []).length === 4, 'zone rows unaffected');
  assert(offHtml2.indexOf('class="hub-dot"') !== -1,
    'hub dot survives the drawer being hidden entirely');

  // Expanding it must not resurrect the programs list — only Status is inside.
  drawerOff._expanded = true; drawerOff._render();
  const openOff = drawerOff.shadowRoot.innerHTML;
  assert(openOff.indexOf('Programs · all zones') === -1,
         'programs stay omitted even if _expanded is set');
  assert(openOff.indexOf('data-act="runtime"') === -1, 'so does the stepper');
  assert(openOff.indexOf('Status · all zones') !== -1,
         'Status is what the expanded drawer holds instead');

  // Interaction with the pre-existing show_actions, which hides the same block.
  const noActions = await mountController({ show_actions: false });
  assert(noActions.shadowRoot.innerHTML.indexOf('data-act="drawer"') !== -1,
         'show_actions false keeps the toggle, for Status');
  const bothOn = await mountController({ show_actions: true, show_programs: true });
  assert(bothOn.shadowRoot.innerHTML.indexOf('data-act="drawer"') !== -1,
         'drawer returns when both are true');

  const ctrlEd = new (customElements.get('bhyve-controller-card-editor'))();
  ctrlEd.setConfig({});
  ctrlEd.hass = makeHass();
  const ctrlSchema = ctrlEd._schema().map(f => f.name);
  assert(ctrlSchema.indexOf('show_programs') !== -1, 'exposed in the controller editor schema');
  assert(ctrlEd._schema().find(f => f.name === 'show_programs')
           .selector.boolean !== undefined, 'rendered as a boolean toggle');
  assert(ctrlEd._computeLabel({ name: 'show_programs' }) === 'Show programs & settings',
         'controller uses its own wording for the shared key');
  // ha-form calls computeLabel unbound, so it must not rely on `this`.
  const unbound = ctrlEd._computeLabel;
  assert(unbound({ name: 'show_programs' }) === 'Show programs & settings',
         'label lookup works unbound');
  // v4 retired the zone card's own show_programs; the controller keeps its.
  const zoneEd2 = new (customElements.get('bhyve-zone-card-editor'))();
  assert(zoneEd2._schema().map(f => f.name).indexOf('show_programs') === -1,
         'zone editor no longer offers show_programs');
  assert(code.indexOf("show_programs: 'Show smart watering and programs'") === -1,
         'the zone-specific label is gone with it');

  group('28. show_smart_watering_and_programs (zone card)');

  // Unset and explicitly true both render the v4 section as normal.
  const secDefault = await mountProgs('a', ['a', 'b', 'c']);
  const secDefHtml = secDefault.shadowRoot.innerHTML;
  assert(secDefault._config.show_smart_watering_and_programs === true, 'defaults to true');
  assert(secDefHtml.indexOf('class="rows"') !== -1, 'section renders when unset');
  assert(secDefHtml.indexOf('2 disabled programs') !== -1,
         'and still uses the v4 fold, collapsed by default');

  const secTrue = await mountProgs('a', ['a', 'b', 'c'],
    { show_smart_watering_and_programs: true });
  assert(secTrue.shadowRoot.innerHTML.indexOf('class="rows"') !== -1,
         'section renders when explicitly true');

  // ── false: the whole block goes, in every v4 state ─────────────────────
  const assertHidden = (card, label) => {
    const h = card.shadowRoot.innerHTML;
    const b = body(h);
    assert(b.indexOf('class="rows"') === -1, label + ': rows container absent');
    assert(b.indexOf('rows-divider') === -1, label + ': divider absent');
    assert(h.indexOf('<div class="primary">Smart watering</div>') === -1,
           label + ': smart watering row absent');
    assert(h.indexOf('Program A') === -1, label + ': program rows absent');
    assert(h.indexOf('disabled program') === -1, label + ': fold row absent');
    assert(h.indexOf('No program enabled') === -1, label + ': neutral row absent');
    assert(h.indexOf('data-act="program"') === -1, label + ': no program handlers');
    assert(h.indexOf('data-act="programs-fold"') === -1, label + ': no fold handler');
    assert(b.indexOf('display: none') === -1 && b.indexOf('hidden') === -1,
           label + ': omitted from the DOM, not hidden with CSS');
  };

  // (1) a program enabled
  assertHidden(await mountProgs('a', ['a', 'b', 'c'],
    { show_smart_watering_and_programs: false }), 'enabled-program state');

  // (2) no program enabled — the neutral row must go too, not just the normal case
  assertHidden(await mountProgs(null, ['a', 'b', 'c'],
    { show_smart_watering_and_programs: false }), 'no-program-enabled state');

  // (3) with a smart-watering entity present, which is otherwise always visible
  const hiddenSmart = await mountZone({ entity: 'valve.front_lawn',
    program_entities: ['a', 'b', 'c'].map(P),
    smart_watering_entity: 'switch.front_lawn_smart_watering',
    show_smart_watering_and_programs: false },
    makeHass({ states: (() => {
      const x = progStates('a', ['a', 'b', 'c']);
      x['switch.front_lawn_smart_watering'] = st('on', { soil_moisture_level: 61 });
      return x; })() }));
  assertHidden(hiddenSmart, 'smart-watering-present state');

  // (4) mid-selection: a selection made before hiding leaves nothing behind
  const midHass = makeHass({ states: progStates('a', ['a', 'b', 'c']) });
  const mid = await mountZone({ entity: 'valve.garden_beds',
    program_entities: ['a', 'b', 'c'].map(P) }, midHass);
  mid._programsOpen = true; mid._render();
  mid.shadowRoot.querySelectorAll('[data-act]')
    .find(e => e.dataset.act === 'program' && e.dataset.entity === P('c')).click();
  assert(mid._isOn(P('c')) === true, 'selection applied while the section was visible');
  mid.setConfig({ entity: 'valve.garden_beds',
                  program_entities: ['a', 'b', 'c'].map(P),
                  show_smart_watering_and_programs: false });
  mid._render();
  assertHidden(mid, 'mid-selection state');
  assert(mid._isOn(P('c')) === true, 'the optimistic selection survives hiding the section');

  // Everything outside the section is untouched.
  const outside = await mountProgs('a', ['a', 'b', 'c'],
    { show_smart_watering_and_programs: false });
  const oHtml = outside.shadowRoot.innerHTML;
  assert(oHtml.indexOf('class="chips"') !== -1, 'chip row unaffected');
  assert(oHtml.indexOf('data-act="run"') !== -1, 'Run button unaffected');
  assert(oHtml.indexOf('Idle · station 2') !== -1, 'header unaffected');

  // ── editor surface ─────────────────────────────────────────────────────
  const zEd = new (customElements.get('bhyve-zone-card-editor'))();
  zEd.setConfig({ entity: 'valve.front_lawn' });
  zEd.hass = makeHass();
  const zNames = zEd._schema().map(f => f.name);
  assert(zNames.indexOf('show_smart_watering_and_programs') !== -1,
         'exposed in the zone editor schema');
  assert(zEd._schema().find(f => f.name === 'show_smart_watering_and_programs')
           .selector.boolean !== undefined, 'rendered as a boolean toggle');
  assert(zEd._computeLabel({ name: 'show_smart_watering_and_programs' }) ===
         'Show smart watering and programs', 'has a human-readable label');
  assert(zNames.indexOf('show_programs') === -1,
         'the retired v3 key is not resurrected alongside it');
  // Naming convention: every boolean option is show_*, positive, default true.
  assert(code.indexOf('hide_') === -1, 'no negative-polarity option was introduced');


  group('29. v5b controller — hub dot and the Status section');

  // Section body: everything between the Status heading and the divider that
  // separates read-only rows from the controls below.
  const statusBody = h => {
    // With the controls hidden there is no divider after the section, so the
    // capture also has to be able to run to the end of the card.
    const m = /<b>Status · all zones<\/b>([\s\S]*?)(?:<div class="hr">|$)/.exec(h);
    return m ? m[1] : '';
  };
  const statRows = h => {
    const out = [];
    const re = /<div class="primary">([^<]*)<\/div>\s*<div class="secondary[^"]*">([^<]*)<\/div>\s*<\/div>\s*<span class="stat-val">([^<]*)<\/span>/g;
    let m;
    while ((m = re.exec(h))) out.push({ title: m[1], note: m[2], value: m[3] });
    return out;
  };
  const openDrawer = card => {
    card.shadowRoot.querySelectorAll('[data-act]')
      .find(el => el.dataset.act === 'drawer').click();
    return body(card.shadowRoot.innerHTML);
  };

  // ── the top-level chip row is gone ─────────────────────────────────────
  const v5 = await mountController({});
  let v5html = body(v5.shadowRoot.innerHTML);
  assert(v5html.indexOf('class="chips"') === -1, 'controller has no summary chip row');
  assert(chipLabels(v5html).length === 0, 'no chip renders anywhere on the collapsed card');
  assert(/<\/div>\s*<button class="drawer-btn/.test(v5html),
    'zone rows run straight into the drawer toggle');

  // ── hub dot ────────────────────────────────────────────────────────────
  assert((v5html.match(/class="hub-dot/g) || []).length === 1, 'exactly one hub dot');
  assert(/<div class="icon-wrap">\s*<div class="shape lg"[\s\S]*?<\/div>\s*<span class="hub-dot/
    .test(v5html), 'the dot is overlaid on the header shape icon');
  assert(v5html.indexOf('Hub online') !== -1, 'online dot is labelled for screen readers');
  const v5raw = v5.shadowRoot.innerHTML;
  assert(/\.hub-dot \{[\s\S]*?background: rgb\(var\(--mush-rgb-green/.test(v5raw),
    'online dot is green');
  assert(/\.hub-dot\.off \{ background: rgb\(var\(--mush-rgb-red/.test(v5raw),
    'offline dot is red');
  assert(/\.hub-dot \{[\s\S]*?width: 12px; height: 12px/.test(v5raw), 'dot is 12px');
  assert(/\.hub-dot \{[\s\S]*?right: -1px; bottom: -1px/.test(v5raw),
    'dot sits bottom-right of the icon');
  assert(/box-shadow: 0 0 0 2px var\(--ha-card-background/.test(v5raw),
    'dot is ringed 2px in the card background, so it survives a dark theme');

  // Present in both drawer states — that is the whole "always visible" rule.
  const v5open = openDrawer(v5);
  assert((v5open.match(/class="hub-dot/g) || []).length === 1,
    'dot still rendered with the drawer expanded');

  const offlineStates = baseStates();
  offlineStates['binary_sensor.front_lawn_connected'] = st('off');
  const hubOff = await mountController({}, makeHass({ states: offlineStates }));
  let hubOffHtml = body(hubOff.shadowRoot.innerHTML);
  assert(hubOffHtml.indexOf('class="hub-dot off"') !== -1, 'offline adds the .off modifier');
  assert(hubOffHtml.indexOf('Hub offline') !== -1, 'offline dot is labelled offline');
  assert(body(openDrawer(hubOff)).indexOf('class="hub-dot off"') !== -1,
    'offline dot survives expanding the drawer');

  // ── Status · all zones ─────────────────────────────────────────────────
  const stat = await mountController({});
  let statHtml = openDrawer(stat);
  assert(statHtml.indexOf('Status · all zones') !== -1, 'drawer has the Status section');
  assert(statHtml.indexOf('Status · all zones') < statHtml.indexOf('Programs · all zones'),
    'Status comes before Programs');
  assert(statHtml.indexOf('Programs · all zones') < statHtml.indexOf('Rain delay'),
    'Programs still comes before Rain delay');
  assert(statHtml.indexOf('Rain delay') < statHtml.indexOf('Run time'),
    'Rain delay still comes before Run time');
  assert(statHtml.indexOf('Read-only. One row per device-level fact') !== -1,
    'section sub-line says it is read-only');

  let rows = statRows(statusBody(statHtml));
  assert(rows.length === 3, 'three rows when no weekly-volume helper is configured');
  assert(rows[0].title === 'Hub', 'row 1 is Hub');
  assert(rows[0].value === 'Online', 'Hub value reads Online');
  assert(rows[0].note === 'Wi-Fi bridge',
    'signal strength omitted, not faked, when no sensor resolves');
  assert(rows[1].title === 'Battery', 'row 2 is Battery');
  assert(rows[1].value === '85%', 'battery value is the device battery percentage');
  assert(rows[1].note === 'Controller', 'battery sub-line claims no charging state');
  assert(rows[2].title === 'Next run', 'row 3 is Next run');
  assert(rows[2].note === 'Earliest across all zones · Front Lawn',
    'next run names the earliest zone');
  assert(/^(Today|Tomorrow|\w{3}) \d/.test(rows[2].value), 'next run value is a time');

  // Read-only means no control in the section, not a switch styled to look inert.
  const sBody = statusBody(statHtml);
  assert(sBody.indexOf('class="sw') === -1, 'no toggle switch on any status row');
  assert(sBody.indexOf('data-act') === -1, 'no status row is interactive');
  assert(sBody.indexOf('<button') === -1, 'no button in the section');
  assert((sBody.match(/class="stat-val"/g) || []).length === 3,
    'every status row carries a right-aligned value instead');
  assert(/\.stat-val \{[\s\S]*?font-variant-numeric: tabular-nums/.test(stat.shadowRoot.innerHTML),
    'values use tabular numerals');

  // Hub is the one row that carries colour, on its icon rather than its value.
  assert(sBody.indexOf('mdi:wifi"') !== -1, 'Hub row uses the wifi icon');
  assert(sBody.indexOf('mdi:clock-outline') !== -1, 'Next run uses a clock icon');
  const offRows = statRows(statusBody(body(hubOff.shadowRoot.innerHTML)));
  assert(offRows[0].value === 'Offline', 'Hub value flips to Offline');
  assert(/^Not reachable · last seen /.test(offRows[0].note),
    'offline sub-line says when it was last seen');
  assert(statusBody(body(hubOff.shadowRoot.innerHTML)).indexOf('mdi:wifi-off') !== -1,
    'offline Hub row uses the wifi-off icon');

  // Signal strength appears when an entity actually resolves.
  const sigStates = Object.assign(baseStates(), { 'sensor.hub_rssi': st('-58') });
  const withSig = await mountController({ signal_entity: 'sensor.hub_rssi' },
    makeHass({ states: sigStates }));
  assert(statRows(statusBody(openDrawer(withSig)))[0].note === 'Wi-Fi bridge · -58 dBm',
    'signal strength is appended when it resolves');

  // ── drawer summary text ────────────────────────────────────────────────
  const hintOf = h => {
    const m = /class="drawer-btn[^"]*"[\s\S]*?<span>([^<]*)<\/span>/.exec(h);
    return m ? m[1] : '';
  };
  assert(hintOf(body(v5.shadowRoot.innerHTML)) === 'Status · 3 programs · rain delay · run time',
    'collapsed summary text names the Status section first');

  // ── weekly volume aggregation ──────────────────────────────────────────
  const weekRow = card => statRows(statusBody(openDrawer(card))).find(r => r.title === 'This week');

  const oneHelper = await mountController({ weekly_volume_entity: 'sensor.week' },
    makeHass({ states: Object.assign(baseStates(), { 'sensor.week': st('48.6') }) }));
  let w = weekRow(oneHelper);
  assert(!!w, 'a configured helper adds the This week row');
  assert(w.value === '48.6 gal', 'single helper is used as-is');
  assert(w.note === 'All zones combined',
    'one device-level helper is a whole-controller total by definition');

  const partial = await mountController(
    { weekly_volume_entity: ['sensor.w1', 'sensor.w2'] },
    makeHass({ states: Object.assign(baseStates(),
      { 'sensor.w1': st('10'), 'sensor.w2': st('5.5') }) }));
  w = weekRow(partial);
  assert(w.value === '15.5 gal', 'a list is summed, not overwritten');
  assert(w.note === '2 of 4 zones',
    'a list covering fewer helpers than zones is labelled a partial total');

  const complete = await mountController(
    { weekly_volume_entity: ['sensor.w1', 'sensor.w2', 'sensor.w3', 'sensor.w4'] },
    makeHass({ states: Object.assign(baseStates(), { 'sensor.w1': st('10'),
      'sensor.w2': st('5.5'), 'sensor.w3': st('4'), 'sensor.w4': st('0.5') }) }));
  w = weekRow(complete);
  assert(w.value === '20.0 gal', 'four helpers sum');
  assert(w.note === 'All zones combined', 'a list covering every zone is not called partial');

  const someUnavailable = await mountController(
    { weekly_volume_entity: ['sensor.w1', 'sensor.w2', 'sensor.w3'] },
    makeHass({ states: Object.assign(baseStates(),
      { 'sensor.w1': st('10'), 'sensor.w2': st('unavailable'), 'sensor.w3': st('2') }) }));
  w = weekRow(someUnavailable);
  assert(w.value === '12.0 gal', 'unavailable helpers are skipped, not counted as zero');
  assert(w.note === '2 of 4 zones', 'the partial count reflects what actually reported');

  const metric = await mountController({ weekly_volume_entity: 'sensor.week' },
    makeHass({ states: Object.assign(baseStates(),
      { 'sensor.week': st('184', { unit_of_measurement: 'L' }) }) }));
  assert(weekRow(metric).value === '184.0 L', 'the helper unit is honoured');

  const zeroWeekCtrl = await mountController({ weekly_volume_entity: 'sensor.week' },
    makeHass({ states: Object.assign(baseStates(), { 'sensor.week': st('0') }) }));
  assert(!weekRow(zeroWeekCtrl), 'a zero total renders no row, as the chip never did');
  assert(!weekRow(await mountController({})), 'no row when nothing is configured');

  // ── v4 zone card is untouched ──────────────────────────────────────────
  const v4zone = await mountZone({ entity: 'valve.front_lawn' });
  const v4html = body(v4zone.shadowRoot.innerHTML);
  assert(v4html.indexOf('class="chips"') !== -1, 'the zone card keeps its chip row');
  assert(v4html.indexOf('hub-dot') === -1, 'the hub dot is controller-only');
  assert(v4html.indexOf('stat-val') === -1, 'status rows are controller-only');

  group('30. Status is not gated by show_actions or show_programs');

  // Four rows, so a missing one is a visible failure rather than a silent
  // shortening of the list.
  const WEEK4 = ['sensor.w1', 'sensor.w2', 'sensor.w3', 'sensor.w4'];
  const week4Hass = () => makeHass({ states: Object.assign(baseStates(),
    { 'sensor.w1': st('21.4'), 'sensor.w2': st('16.8'),
      'sensor.w3': st('7.2'),  'sensor.w4': st('3.2') }) });
  const fourRows = (card, label) => {
    const h = openDrawer(card);
    assert(h.indexOf('Status · all zones') !== -1, label + ': section present');
    const r = statRows(statusBody(h));
    assert(r.length === 4, label + ': all four rows render');
    assert(r.map(x => x.title).join(',') === 'Hub,Battery,Next run,This week',
      label + ': rows in the design order');
    assert(r[0].value === 'Online', label + ': Hub value intact');
    assert(r[1].value === '85%', label + ': Battery value intact');
    assert(/^(Today|Tomorrow|\w{3}) \d/.test(r[2].value), label + ': Next run value intact');
    assert(r[3].value === '48.6 gal', label + ': This week total intact');
    assert(r[3].note === 'All zones combined', label + ': aggregation note intact');
    assert(statusBody(h).indexOf('class="sw') === -1, label + ': still read-only');
    return h;
  };

  // ── show_actions: false ────────────────────────────────────────────────
  const noActs = await mountController(
    { show_actions: false, weekly_volume_entity: WEEK4 }, week4Hass());
  let naCollapsed = noActs.shadowRoot.innerHTML;
  assert(naCollapsed.indexOf('data-act="drawer"') !== -1,
    'show_actions false: the toggle is still there to reach Status');
  assert(naCollapsed.indexOf('class="hub-dot"') !== -1,
    'show_actions false: hub dot unaffected');
  let naOpen = fourRows(noActs, 'show_actions false');
  // What show_actions is actually for is still gone.
  assert(naOpen.indexOf('data-act="run"') === -1, 'show_actions false: no Run buttons');
  assert(naOpen.indexOf('data-act="stop"') === -1, 'show_actions false: no Stop buttons');
  assert(naOpen.indexOf('data-act="runtime"') === -1, 'show_actions false: no run-time stepper');
  assert(naOpen.indexOf('Programs · all zones') === -1, 'show_actions false: no programs list');
  assert(naOpen.indexOf('data-act="mode"') !== -1, 'show_actions false: Auto/Off still stays');
  assert(naOpen.indexOf('class="hub-dot"') !== -1,
    'show_actions false: hub dot survives expanding too');

  // ── show_programs: false ───────────────────────────────────────────────
  const noProgs = await mountController(
    { show_programs: false, weekly_volume_entity: WEEK4 }, week4Hass());
  let npCollapsed = noProgs.shadowRoot.innerHTML;
  assert(npCollapsed.indexOf('data-act="drawer"') !== -1,
    'show_programs false: the toggle is still there to reach Status');
  assert(npCollapsed.indexOf('class="hub-dot"') !== -1,
    'show_programs false: hub dot unaffected');
  let npOpen = fourRows(noProgs, 'show_programs false');
  assert(npOpen.indexOf('Programs · all zones') === -1, 'show_programs false: no programs list');
  assert(npOpen.indexOf('data-act="toggle"') === -1, 'show_programs false: no program switches');
  assert(npOpen.indexOf('Rain delay') === -1, 'show_programs false: no rain delay row');
  assert(npOpen.indexOf('data-act="runtime"') === -1, 'show_programs false: no run-time stepper');
  // What show_programs never claimed to touch is still there.
  assert(npOpen.indexOf('data-act="run"') !== -1, 'show_programs false: Run buttons unaffected');
  assert(npOpen.indexOf('data-act="mode"') !== -1, 'show_programs false: Auto/Off unaffected');

  // ── both false ─────────────────────────────────────────────────────────
  const neither = await mountController(
    { show_actions: false, show_programs: false, weekly_volume_entity: WEEK4 }, week4Hass());
  const bothOpen = fourRows(neither, 'both false');
  assert(bothOpen.indexOf('data-act="run"') === -1, 'both false: no Run buttons');
  assert(bothOpen.indexOf('Programs · all zones') === -1, 'both false: no programs list');
  assert(neither.shadowRoot.innerHTML.indexOf('class="hub-dot"') !== -1,
    'both false: hub dot unaffected');

  // ── the toggle still toggles, and still starts closed ──────────────────
  const gesture = await mountController(
    { show_programs: false, weekly_volume_entity: WEEK4 }, week4Hass());
  assert(gesture._expanded === false, 'still collapsed by default — the card stays compact');
  assert(gesture.shadowRoot.innerHTML.indexOf('Status · all zones') === -1,
    'Status is behind the toggle, not always on screen');
  assert(gesture.shadowRoot.innerHTML.indexOf('Show status') !== -1,
    'the collapsed row says what one tap will show');
  assert(openDrawer(gesture).indexOf('Status · all zones') !== -1,
    'the same tap gesture opens it');
  assert(gesture._expanded === true, 'and sets the same _expanded flag as before');
  assert(gesture.shadowRoot.innerHTML.indexOf('Hide status') !== -1, 'open row offers to hide');
  openDrawer(gesture);
  assert(gesture._expanded === false, 'tapping again closes it');
  assert(gesture.shadowRoot.innerHTML.indexOf('Status · all zones') === -1,
    'and Status goes back behind the toggle');

  // The hint line names only what is actually inside — and with Status the only
  // thing inside, the label already says so, so there is no sub-line at all.
  assert(hintOf(body(gesture.shadowRoot.innerHTML)) === '',
    'no sub-line repeating the label when Status is all there is');
  const bothHint = await mountController({ weekly_volume_entity: WEEK4 }, week4Hass());
  assert(hintOf(body(bothHint.shadowRoot.innerHTML)) ===
    'Status · 3 programs · rain delay · run time',
    'and lists everything when the controls are there');
  assert(bothHint.shadowRoot.innerHTML.indexOf('Show programs &amp; settings') !== -1,
    'the default label is unchanged');

  // A controller with nothing to report renders no toggle at all. Every entity
  // that backs a Status row is discovered from the registry, so this state is
  // only reachable on a device that has none of them — assert the guard directly.
  const guard = await mountController({ show_programs: false }, week4Hass());
  assert(guard._drawer({ programs: [] }, [], false) === '',
    'no toggle when neither Status nor the controls have anything in them');
  assert(guard._drawer({ programs: [] }, [], true) !== '',
    'but the controls alone are still enough to render one');

  // ── Summary ──────────────────────────────────────────────────────────────
  process.stdout.write('\n-----------------------------------------\n');
  process.stdout.write('Results: ' + passed + ' passed, ' + failed + ' failed\n');
  if (failed) {
    process.stdout.write('Failed:\n');
    errors.forEach(e => process.stdout.write('  - ' + e + '\n'));
    process.exit(1);
  }
  process.stdout.write('All tests passed.\n');
  // Cards that render a running zone leave a 1s tick behind; exit explicitly
  // rather than waiting on them.
  process.exit(0);
}

main().catch(e => { process.stderr.write(String(e && e.stack || e) + '\n'); process.exit(1); });
