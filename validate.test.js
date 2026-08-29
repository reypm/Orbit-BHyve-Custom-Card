// Headless validation for the v5 single card.
// Stubs just enough browser surface to render it and dispatch real clicks.
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
      soil_moisture_level: 61, run_times: [{ station: 1, run_time: 12 }] }),

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


async function mountCard(config, hass) {
  const Card = customElements.get('bhyve-card');
  const card = new Card();
  card.setConfig(config || {});
  card.hass = hass || makeHass();
  await flush();
  card._render();
  return card;
}

// Tap one of the two accordion toggles the way a user would, and hand back the
// markup it produced.
function tapSection(card, id) {
  const btn = card.shadowRoot.querySelectorAll('[data-act]')
    .find(el => el.dataset.act === 'section' && el.dataset.section === id);
  if (!btn) throw new Error('no toggle for section ' + id);
  btn.click();
  return body(card.shadowRoot.innerHTML);
}

// The label and sub-line of one accordion toggle.
function sectionBtn(html, id) {
  const re = new RegExp('<button class="drawer-btn([^"]*)" data-act="section"\\s*' +
    'data-section="' + id + '">\\s*<ha-icon icon="([^"]+)"[^>]*>[\\s\\S]*?' +
    '<b>([^<]*)</b>\\s*(?:<span>([^<]*)</span>)?', 'm');
  const m = re.exec(html);
  return m ? { open: /open/.test(m[1]), icon: m[2], label: m[3], hint: m[4] || '' } : null;
}

// Everything the open accordion rendered, from its toggle to the next toggle
// or the end of the card.
function sectionBody(html, id) {
  const start = html.indexOf('data-section="' + id + '"');
  if (start === -1) return '';
  const open = html.indexOf('<div class="drawer">', start);
  if (open === -1) return '';
  const next = html.indexOf('<button class="drawer-btn', open);
  return html.slice(open, next === -1 ? html.length : next);
}

// { title, note, value } per read-only Status row.
function statRows(html) {
  const out = [];
  const re = /<div class="primary">([^<]*)<\/div>\s*<div class="secondary[^"]*">([^<]*)<\/div>\s*<\/div>\s*<span class="stat-val">([^<]*)<\/span>/g;
  let m;
  while ((m = re.exec(html))) out.push({ title: m[1], note: m[2], value: m[3] });
  return out;
}

// { name, detail, off } per program row, in render order.
function progRows(html) {
  const out = [];
  const re = /<div class="row( prog-off)?">\s*<div class="shape"[\s\S]*?<div class="primary">([^<]*)<\/div>\s*<div class="secondary[^"]*">([^<]*)<\/div>[\s\S]*?data-act="toggle" data-entity="([^"]*)"/g;
  let m;
  while ((m = re.exec(html))) out.push({ off: !!m[1], name: m[2], detail: m[3], entity: m[4] });
  return out;
}

// ── Tests ──────────────────────────────────────────────────────────────────
async function main() {
  let html;
  const noFault = s => { s['binary_sensor.bhyve_xr_fault'] = st('off', { station_faults: [] }); };
  const clean = mutate => makeHass({ states: (() => {
    const x = baseStates(); noFault(x); if (mutate) mutate(x); return x; })() });
  const WEEK4 = ['sensor.w1', 'sensor.w2', 'sensor.w3', 'sensor.w4'];
  const week4 = mutate => makeHass({ states: (() => {
    const x = baseStates(); noFault(x);
    Object.assign(x, { 'sensor.w1': st('21.4'), 'sensor.w2': st('16.8'),
                       'sensor.w3': st('7.2'),  'sensor.w4': st('3.2') });
    if (mutate) mutate(x); return x; })() });

  group('1. One card, not two');
  const Card = customElements.get('bhyve-card');
  assert(!!Card, 'bhyve-card registered');
  assert(!!customElements.get('bhyve-card-editor'), 'bhyve-card-editor registered');
  assert(customElements.get('bhyve-zone-card') === null,
    'bhyve-zone-card is gone, not left behind as a stub');
  assert(customElements.get('bhyve-zone-card-editor') === null, 'so is its editor');
  assert(window.customCards.length === 1, 'the picker offers exactly one card');
  assert(window.customCards[0].type === 'bhyve-card', 'and it is bhyve-card');
  assert(/flood/i.test(window.customCards[0].description),
    'whose description says it also does flood sensors');

  // v4 dashboards say custom:bhyve-controller-card. Same card, kept alive.
  const Legacy = customElements.get('bhyve-controller-card');
  assert(!!Legacy, 'the v4 controller-card name is still registered');
  assert(Legacy !== Card, 'as its own constructor — a name cannot be defined twice');
  assert(Legacy.prototype instanceof Card, 'but it is the same card by inheritance');
  assert(!window.customCards.find(c => c.type === 'bhyve-controller-card'),
    'the alias is deliberately absent from the picker');
  const legacyCard = new Legacy();
  legacyCard.setConfig({});
  legacyCard.hass = clean();
  await flush();
  legacyCard._render();
  assert(legacyCard.shadowRoot.innerHTML.indexOf('Front Yard') !== -1,
    'a v4 config renders through the alias unchanged');
  assert(legacyCard.shadowRoot.innerHTML.indexOf('data-section="settings"') !== -1,
    'including the v5 sections');

  group('2. setConfig');
  let threw = false;
  try { new Card().setConfig(null); } catch (e) { threw = true; }
  assert(threw, 'a null config throws');
  const defaults = await mountCard({});
  assert(defaults._config.show_actions === true, 'show_actions defaults to true');
  assert(defaults._config.show_programs === true, 'show_programs defaults to true');
  assert(defaults._open.settings === false && defaults._open.programs === false,
    'both sections start closed');
  assert(Card.getStubConfig().show_actions === true, 'the stub config is renderable');

  group('3. Header and zone rows');
  const card = await mountCard({}, clean());
  html = body(card.shadowRoot.innerHTML);
  assert(html.indexOf('Front Yard') !== -1, 'device name from the registry');
  assert(html.indexOf('B-hyve XR') !== -1, 'model in the secondary line');
  assert(html.indexOf('1 zone watering') !== -1, 'aggregate state counts running zones');
  assert(html.indexOf('data-act="mode"') !== -1, 'Auto/Off segmented control');
  assert(html.indexOf('<select') === -1, 'mode is not a dropdown');
  assert((html.match(/class="zone-row"/g) || []).length === 4, 'one row per zone, inline');
  assert(html.indexOf('class="chips"') === -1, 'no chip row anywhere on the card');
  const rowOrder = (h => {
    const out = []; const re = /data-act="more-info" data-entity="([^"]+)"/g; let m;
    while ((m = re.exec(h))) out.push(m[1]);
    return out;
  })(html);
  assert(rowOrder.join(',') ===
    'valve.front_lawn,valve.garden_beds,valve.side_strip,valve.back_lawn',
    'rows sorted by station number, not alphabetically');
  assert(html.indexOf('Watering · ') !== -1, 'a running zone shows its countdown');
  assert(html.indexOf('data-act="stop"') !== -1, 'and a Stop button');
  assert(html.indexOf('data-act="run"') !== -1, 'idle zones offer Run');
  assert(/data-act="run"[^>]*data-minutes="10"/.test(html), 'Run carries its duration');

  const faulted = await mountCard({});
  assert(faulted.shadowRoot.innerHTML.indexOf('Fault detected') !== -1,
    'a station fault reaches the header status');
  assert(faulted.shadowRoot.innerHTML.indexOf(RGB_RED_HINT) !== -1,
    'and raises the red banner');

  group('4. Device Off');
  const offCard = await mountCard({}, clean(x => {
    x['select.bhyve_xr_device_mode'] = st('off', { options: ['auto', 'off'] });
    x['valve.front_lawn'] = st('closed', { station: 1, zone_name: 'Front Lawn' });
  }));
  const offHtml = body(offCard.shadowRoot.innerHTML);
  assert(offHtml.indexOf('Controller is off') !== -1, 'orange banner');
  assert(offHtml.indexOf('class="banner orange"') !== -1, 'in the orange treatment');
  assert(offHtml.indexOf('>Idle<') === -1, 'no zone row still reads Idle');

  group('5. Hub dot');
  assert((html.match(/class="hub-dot/g) || []).length === 1, 'exactly one dot');
  assert(/<div class="icon-wrap">\s*<div class="shape lg"[\s\S]*?<\/div>\s*<span class="hub-dot/
    .test(html), 'overlaid on the header shape icon');
  assert(html.indexOf('Hub online') !== -1, 'labelled online');
  const raw = card.shadowRoot.innerHTML;
  assert(/\.hub-dot \{[\s\S]*?background: rgb\(var\(--mush-rgb-green/.test(raw), 'green online');
  assert(/\.hub-dot\.off \{ background: rgb\(var\(--mush-rgb-red/.test(raw), 'red offline');
  assert(/\.hub-dot \{[\s\S]*?width: 12px; height: 12px/.test(raw), '12px');
  assert(/\.hub-dot \{[\s\S]*?right: -1px; bottom: -1px/.test(raw), 'bottom-right of the icon');
  assert(/box-shadow: 0 0 0 2px var\(--ha-card-background/.test(raw),
    'ringed in the card background, so it survives a dark theme');

  assert((tapSection(card, 'settings').match(/class="hub-dot/g) || []).length === 1,
    'still there with settings open');
  assert((tapSection(card, 'programs').match(/class="hub-dot/g) || []).length === 1,
    'and with both sections open');

  const hubOff = await mountCard({}, clean(x => {
    x['binary_sensor.front_lawn_connected'] = st('off'); }));
  assert(body(hubOff.shadowRoot.innerHTML).indexOf('class="hub-dot off"') !== -1,
    'offline adds the .off modifier');
  assert(body(hubOff.shadowRoot.innerHTML).indexOf('Hub offline') !== -1, 'labelled offline');

  group('6. Two accordions, independent');
  const acc = await mountCard({ weekly_volume_entity: WEEK4 }, week4());
  let accHtml = body(acc.shadowRoot.innerHTML);
  let sSet = sectionBtn(accHtml, 'settings');
  let sProg = sectionBtn(accHtml, 'programs');
  assert(!!sSet && !!sProg, 'both toggle rows render');
  assert(accHtml.indexOf('data-section="settings"') < accHtml.indexOf('data-section="programs"'),
    'settings comes first, programs second');
  assert(sSet.label === 'Show settings &amp; configuration', 'settings label');
  assert(sSet.hint === 'Status · rain delay · run time', 'settings sub-line');
  assert(sSet.icon === 'mdi:tune', 'settings icon');
  assert(sProg.label === 'Show programs · all zones', 'programs label');
  assert(sProg.hint === '2 enabled · 1 disabled', 'programs sub-line counts both halves');
  assert(sProg.icon === 'mdi:calendar-month', 'programs icon');
  assert(accHtml.indexOf('class="drawer"') === -1, 'nothing expanded by default');
  assert(accHtml.indexOf('programs &amp; settings') === -1,
    'the v4 combined label is retired, not left on one of them');

  accHtml = tapSection(acc, 'settings');
  assert(acc._open.settings === true && acc._open.programs === false,
    'opening one leaves the other closed');
  assert(sectionBtn(accHtml, 'settings').open === true, 'the opened toggle is styled open');
  assert(sectionBtn(accHtml, 'settings').label === 'Hide settings &amp; configuration',
    'and offers to hide');
  assert(sectionBtn(accHtml, 'programs').open === false, 'the other is untouched');
  assert(sectionBody(accHtml, 'settings').indexOf('Status · all zones') !== -1,
    'settings holds Status');
  assert(sectionBody(accHtml, 'settings').indexOf('Programs · all zones') === -1,
    'and not the programs list');

  accHtml = tapSection(acc, 'programs');
  assert(acc._open.settings === true && acc._open.programs === true, 'both can be open at once');
  assert(sectionBody(accHtml, 'programs').indexOf('Programs · all zones') !== -1,
    'programs holds the merged list');
  accHtml = tapSection(acc, 'settings');
  assert(acc._open.settings === false && acc._open.programs === true,
    'closing one leaves the other open');

  group('7. Settings section — order and read-only Status');
  const set = await mountCard({ weekly_volume_entity: WEEK4 }, week4());
  const setBody = sectionBody(tapSection(set, 'settings'), 'settings');
  assert(setBody.indexOf('Status · all zones') < setBody.indexOf('Rain delay'),
    'Status before Rain delay');
  assert(setBody.indexOf('Rain delay') < setBody.indexOf('Run time'),
    'Rain delay before Run time');
  assert(setBody.indexOf('Read-only. One row per device-level fact') !== -1,
    'the section says it is read-only and device-level');
  assert(/Status · all zones<\/b>[\s\S]*?<div class="hr">[\s\S]*?Rain delay/.test(setBody),
    'a divider separates the read-only rows from the controls');
  const rows = statRows(setBody);
  assert(rows.length === 4, 'four Status rows');
  assert(rows.map(r => r.title).join(',') === 'Hub,Battery,Next run,This week',
    'in the design order');
  assert(rows[0].value === 'Online' && rows[0].note === 'Wi-Fi bridge',
    'Hub: online, signal omitted when no sensor resolves');
  assert(rows[1].value === '85%' && rows[1].note === 'Controller',
    'Battery: level, and no charging state the integration cannot back');
  assert(rows[2].note === 'Earliest across all zones · Front Lawn',
    'Next run names the zone that owns it');
  assert(/^(Today|Tomorrow|\w{3}) \d/.test(rows[2].value), 'and shows a time');
  assert(rows[3].value === '48.6 gal' && rows[3].note === 'All zones combined',
    'This week is the summed total');
  const statusOnly = setBody.slice(0, setBody.indexOf('<div class="hr">'));
  assert(statusOnly.indexOf('class="sw') === -1, 'no switch on any Status row');
  assert(statusOnly.indexOf('data-act') === -1, 'no Status row is interactive');
  assert((statusOnly.match(/class="stat-val"/g) || []).length === 4,
    'every one carries a right-aligned value instead');
  assert(/\.stat-val \{[\s\S]*?font-variant-numeric: tabular-nums/.test(set.shadowRoot.innerHTML),
    'values use tabular numerals');
  assert(setBody.indexOf('data-act="rain"') !== -1, 'the rain delay toggle is live');
  assert(setBody.indexOf('data-act="runtime"') !== -1, 'so is the run-time stepper');
  assert(setBody.indexOf('Sets manual preset on every zone') !== -1,
    'the stepper says what it writes');

  group('8. Status data');
  const sigCard = await mountCard({ signal_entity: 'sensor.hub_rssi' },
    clean(x => { x['sensor.hub_rssi'] = st('-58'); }));
  assert(statRows(sectionBody(tapSection(sigCard, 'settings'), 'settings'))[0].note ===
    'Wi-Fi bridge · -58 dBm', 'signal strength is appended when it resolves');

  const offRows = statRows(sectionBody(tapSection(hubOff, 'settings'), 'settings'));
  assert(offRows[0].value === 'Offline', 'Hub flips to Offline');
  assert(/^Not reachable · last seen /.test(offRows[0].note), 'and says when it was last seen');
  assert(sectionBody(body(hubOff.shadowRoot.innerHTML), 'settings').indexOf('mdi:wifi-off') !== -1,
    'with the wifi-off icon');

  const lowBat = await mountCard({}, clean(x => {
    x['sensor.front_lawn_battery_level'] = st('12'); }));
  const lowRows = statRows(sectionBody(tapSection(lowBat, 'settings'), 'settings'));
  assert(lowRows[1].value === '12%', 'a low battery still reports its level');
  assert(sectionBody(body(lowBat.shadowRoot.innerHTML), 'settings').indexOf('mdi:battery-alert')
    !== -1, 'with the alert icon');
  assert(sectionBody(body(lowBat.shadowRoot.innerHTML), 'settings').indexOf('255, 152, 0') !== -1,
    'tinted amber, not red');

  group('9. Weekly volume aggregation');
  const weekRow = async (cfg, hass) => {
    const c = await mountCard(cfg, hass);
    return statRows(sectionBody(tapSection(c, 'settings'), 'settings'))
      .find(r => r.title === 'This week');
  };
  let w = await weekRow({ weekly_volume_entity: 'sensor.week' },
    clean(x => { x['sensor.week'] = st('48.6'); }));
  assert(w.value === '48.6 gal', 'one helper is used as-is');
  assert(w.note === 'All zones combined',
    'a single device-level helper is a whole-controller total by definition');

  w = await weekRow({ weekly_volume_entity: ['sensor.w1', 'sensor.w2'] },
    clean(x => { x['sensor.w1'] = st('10'); x['sensor.w2'] = st('5.5'); }));
  assert(w.value === '15.5 gal', 'a list is summed');
  assert(w.note === '2 of 4 zones', 'a short list is disclosed as a partial total');

  w = await weekRow({ weekly_volume_entity: WEEK4 }, week4());
  assert(w.note === 'All zones combined', 'a list covering every zone is not called partial');

  w = await weekRow({ weekly_volume_entity: ['sensor.w1', 'sensor.w2', 'sensor.w3'] },
    clean(x => { x['sensor.w1'] = st('10'); x['sensor.w2'] = st('unavailable');
                 x['sensor.w3'] = st('2'); }));
  assert(w.value === '12.0 gal', 'unavailable helpers are skipped, not counted as zero');
  assert(w.note === '2 of 4 zones', 'and the partial count reflects what reported');

  w = await weekRow({ weekly_volume_entity: 'sensor.week' },
    clean(x => { x['sensor.week'] = st('184', { unit_of_measurement: 'L' }); }));
  assert(w.value === '184.0 L', 'the helper unit is honoured');

  assert(!(await weekRow({ weekly_volume_entity: 'sensor.week' },
    clean(x => { x['sensor.week'] = st('0'); }))), 'a zero total renders no row');
  assert(!(await weekRow({}, clean())), 'and neither does an unconfigured one');

  group('10. Programs section — merged, enabled first, disabled below');
  const progs = await mountCard({}, clean());
  const progBody = sectionBody(tapSection(progs, 'programs'), 'programs');
  assert(progBody.indexOf('Every program on this controller, merged') !== -1,
    'the section states the merged, device-level framing');
  assert(progBody.indexOf('not per zone') !== -1, 'and that it is not per zone');
  const pr = progRows(progBody);
  assert(pr.length === 3, 'every program on the device is listed once');
  assert(pr.filter(p => !p.off).length === 2, 'two enabled');
  assert(pr.filter(p => p.off).length === 1, 'one disabled');
  assert(pr[0].off === false && pr[1].off === false && pr[2].off === true,
    'enabled first, disabled after — never interleaved');
  assert(progBody.indexOf('1 disabled program<') !== -1,
    'the subsection header carries the count, singular');
  assert(/<div class="sub-head">\s*<b>1 disabled program<\/b>\s*<i><\/i>/.test(progBody),
    'as a label with a hairline running to the right edge');
  assert(progBody.indexOf('class="sub-head"') > progBody.indexOf(pr[1].name),
    'the subsection rule sits below the enabled rows');
  assert(progBody.indexOf('class="fold-btn"') === -1,
    'the disabled half is a subsection, not a second fold');
  assert(pr[2].name === 'Program B', 'the disabled program is the one that is off');

  // Every switch is live, including the disabled half.
  const swOf = (h, entity) => new RegExp('class="sw([^"]*)" data-act="toggle" ' +
    'data-entity="' + entity.replace(/\./g, '\\.') + '"').exec(h);
  assert(/on/.test(swOf(progBody, 'switch.bhyve_xr_a_program')[1]), 'enabled switch reads on');
  assert(!/on/.test(swOf(progBody, 'switch.bhyve_xr_b_program')[1]), 'disabled switch reads off');
  assert(/purple/.test(swOf(progBody, 'switch.bhyve_xr_e_program')[1]),
    'the smart program keeps its own colour');

  const pHass = clean();
  const tapProg = await mountCard({}, pHass);
  tapSection(tapProg, 'programs');
  tapProg.shadowRoot.querySelectorAll('[data-act]')
    .find(el => el.dataset.act === 'toggle' && el.dataset.entity === 'switch.bhyve_xr_b_program')
    .click();
  assert(pHass.calls.length === 1, 'tapping a program switch calls one service');
  assert(pHass.calls[0].service === 'turn_on', 'turning a disabled program on');
  assert(pHass.calls[0].data.entity_id === 'switch.bhyve_xr_b_program', 'on that entity alone');
  assert(!pHass.calls.find(c => c.service === 'turn_off'),
    'programs here are independent — enabling one does not disable another');
  const moved = progRows(sectionBody(body(tapProg.shadowRoot.innerHTML), 'programs'));
  assert(moved.filter(p => !p.off).length === 3,
    'the row moves into the enabled half optimistically');
  assert(sectionBtn(body(tapProg.shadowRoot.innerHTML), 'programs').hint === '3 enabled · 0 disabled',
    'and the toggle count follows it');
  assert(sectionBody(body(tapProg.shadowRoot.innerHTML), 'programs').indexOf('class="sub-head"')
    === -1, 'with no empty disabled subsection left behind');

  group('11. A weather-adjusted program states what drives it');
  const smart = pr.find(p => /Program E/.test(p.name));
  assert(!!smart, 'the smart program is in the list');
  assert(smart.detail === 'Weather adjusted · soil 61%',
    'weather-adjusted plus the soil reading, per the design');
  assert(smart.detail.indexOf('min') === -1,
    'no fixed duration — the device picks its own, so printing one would be a lie');
  const noSoil = await mountCard({}, clean(x => {
    x['switch.bhyve_xr_e_program'] = st('on',
      { friendly_name: 'Program E', is_smart_program: true }); }));
  assert(progRows(sectionBody(tapSection(noSoil, 'programs'), 'programs'))
    .find(p => /Program E/.test(p.name)).detail === 'Weather adjusted',
    'the soil half is omitted when nothing reports it');

  group('12. Run time stepper');
  const stepHass = clean();
  const step = await mountCard({}, stepHass);
  tapSection(step, 'settings');
  const stepper = d => step.shadowRoot.querySelectorAll('[data-act]')
    .find(el => el.dataset.act === 'runtime' && el.dataset.delta === d);
  // manual_preset_runtime is SECONDS: 600 on front_lawn is 10 minutes, not 600.
  assert(sectionBody(body(step.shadowRoot.innerHTML), 'settings').indexOf('10 min') !== -1,
    'the preset is read as seconds and shown in minutes');
  stepper('5').click();
  assert(step._runtime === 15, 'plus raises it by 5');
  const call = stepHass.calls[stepHass.calls.length - 1];
  assert(call.service === 'set_manual_preset_runtime', 'writing the preset');
  assert(call.data.minutes === 15, 'in MINUTES, the service unit');
  assert(call.data.entity_id.length === 4, 'to every zone on the controller');
  stepper('-5').click();
  assert(step._runtime === 10, 'minus lowers it again');

  const noSvc = makeHass({ services: { select: { select_option: {} },
                                       homeassistant: { turn_on: {}, turn_off: {} } } });
  const local = await mountCard({}, noSvc);
  tapSection(local, 'settings');
  local.shadowRoot.querySelectorAll('[data-act]')
    .find(el => el.dataset.act === 'runtime' && el.dataset.delta === '5').click();
  assert(local._presetLocal === true, 'a missing service falls back to a local default');
  assert(local.shadowRoot.innerHTML.indexOf('local default') !== -1, 'and says so out loud');

  group('13. Mode and rain delay service calls');
  const svcHass = clean();
  const svc = await mountCard({}, svcHass);
  svc.shadowRoot.querySelectorAll('[data-act]')
    .find(el => el.dataset.act === 'mode' && el.dataset.option === 'off').click();
  assert(svcHass.calls[0].domain === 'select' && svcHass.calls[0].service === 'select_option',
    'Auto/Off drives select.select_option');
  assert(svcHass.calls[0].data.option === 'off', 'with the tapped option');
  tapSection(svc, 'settings');
  svc.shadowRoot.querySelectorAll('[data-act]').find(el => el.dataset.act === 'rain').click();
  const rainCall = svcHass.calls[svcHass.calls.length - 1];
  assert(rainCall.service === 'enable_rain_delay', 'rain delay uses the bhyve service');
  assert(rainCall.data.hours === 24, 'with the default hours');
  const rainCfg = clean();
  const rainCard = await mountCard({ rain_delay_hours: 12 }, rainCfg);
  tapSection(rainCard, 'settings');
  rainCard.shadowRoot.querySelectorAll('[data-act]').find(el => el.dataset.act === 'rain').click();
  assert(rainCfg.calls[0].data.hours === 12, 'rain_delay_hours is honoured');
  const rainOn = await mountCard({}, clean(x => {
    x['switch.bhyve_xr_rain_delay'] = st('on', { delay: 48, cause: 'wind' }); }));
  assert(sectionBody(tapSection(rainOn, 'settings'), 'settings')
    .indexOf('Active · 48 h remaining · wind') !== -1,
    'an active delay shows its remaining hours and cause');

  group('14. show_actions hides controls, never Status');
  const noActs = await mountCard({ show_actions: false, weekly_volume_entity: WEEK4 }, week4());
  let naHtml = body(noActs.shadowRoot.innerHTML);
  assert(naHtml.indexOf('data-act="run"') === -1, 'no Run buttons');
  assert(naHtml.indexOf('data-act="stop"') === -1, 'no Stop buttons');
  assert(naHtml.indexOf('data-act="mode"') !== -1, 'Auto/Off stays — it is authoritative');
  assert(naHtml.indexOf('data-section="programs"') === -1, 'the programs section goes');
  assert(naHtml.indexOf('data-section="settings"') !== -1, 'the settings section stays');
  assert(sectionBtn(naHtml, 'settings').hint === 'Status',
    'and its sub-line names only what is left inside');
  naHtml = tapSection(noActs, 'settings');
  assert(statRows(sectionBody(naHtml, 'settings')).length === 4, 'all four Status rows');
  assert(naHtml.indexOf('data-act="rain"') === -1, 'no rain delay toggle');
  assert(naHtml.indexOf('data-act="runtime"') === -1, 'no run-time stepper');
  assert(naHtml.indexOf('class="hub-dot"') !== -1, 'hub dot unaffected');

  group('15. show_programs hides the programs section alone');
  const noProgs = await mountCard({ show_programs: false, weekly_volume_entity: WEEK4 }, week4());
  let npHtml = body(noProgs.shadowRoot.innerHTML);
  assert(npHtml.indexOf('data-section="programs"') === -1, 'the section is gone');
  assert(npHtml.indexOf('Programs · all zones') === -1, 'and so is its content');
  assert(npHtml.indexOf('data-act="toggle"') === -1, 'no program switches in the DOM');
  assert(body(npHtml).indexOf('display: none') === -1,
    'omitted from the DOM, not hidden with CSS');
  assert(npHtml.indexOf('data-act="run"') !== -1, 'Run buttons unaffected');
  assert(npHtml.indexOf('class="hub-dot"') !== -1, 'hub dot unaffected');
  npHtml = tapSection(noProgs, 'settings');
  assert(statRows(sectionBody(npHtml, 'settings')).length === 4, 'all four Status rows');
  assert(npHtml.indexOf('data-act="rain"') !== -1,
    'rain delay stays — show_programs is about programs');
  assert(npHtml.indexOf('data-act="runtime"') !== -1, 'so does the run-time stepper');
  assert(sectionBtn(npHtml, 'settings').hint === 'Status · rain delay · run time',
    'the settings sub-line is unchanged');

  const neither = await mountCard(
    { show_actions: false, show_programs: false, weekly_volume_entity: WEEK4 }, week4());
  const bothOff = tapSection(neither, 'settings');
  assert(statRows(sectionBody(bothOff, 'settings')).length === 4,
    'both false still leaves every Status row');
  assert(bothOff.indexOf('class="hub-dot"') !== -1, 'and the hub dot');
  assert(bothOff.indexOf('data-section="programs"') === -1, 'with no programs section');

  group('16. zones — entity ids or { entity, name }');
  const strZones = await mountCard(
    { zones: ['valve.side_strip', 'valve.front_lawn'] }, clean());
  assert((body(strZones.shadowRoot.innerHTML).match(/class="zone-row"/g) || []).length === 2,
    'a string list limits the card to those zones');
  assert(body(strZones.shadowRoot.innerHTML).indexOf('Side Strip') !== -1, 'named from the entity');

  const objZones = await mountCard({ zones: [
    { entity: 'valve.front_lawn', name: 'Front & centre' },
    'valve.garden_beds',
  ] }, clean());
  const ozHtml = body(objZones.shadowRoot.innerHTML);
  assert((ozHtml.match(/class="zone-row"/g) || []).length === 2, 'the object form is accepted');
  assert(ozHtml.indexOf('Front &amp; centre') !== -1,
    'its name overrides the entity name, escaped');
  assert(ozHtml.indexOf('Garden Beds') !== -1, 'and the two forms mix in one list');
  assert(ozHtml.indexOf('Front Lawn') === -1, 'the overridden name is not also shown');
  const nextNote = statRows(sectionBody(tapSection(objZones, 'settings'), 'settings'))
    .find(r => r.title === 'Next run').note;
  assert(nextNote.indexOf('Front &amp; centre') !== -1,
    'and the override reaches the Next run row too');

  const inferred = await mountCard({ zones: ['valve.garden_beds'] }, clean());
  assert(body(inferred.shadowRoot.innerHTML).indexOf('Front Yard') !== -1,
    'the device is inferred from the first zone when device_id is absent');

  group('17. Flood sensors, on the same card');
  const dry = await mountCard({ entity: 'binary_sensor.basement_flood_sensor' });
  let fh = body(dry.shadowRoot.innerHTML);
  assert(fh.indexOf('mdi:home-flood') !== -1, 'flood icon');
  assert(fh.indexOf('>Dry<') !== -1, 'dry state');
  assert(fh.indexOf('class="zone-row"') === -1, 'no controller parts');
  assert(fh.indexOf('data-section=') === -1, 'and no accordions');
  const floodChips = chipLabels(fh);
  assert(floodChips.length === 3, 'temperature, signal and battery chips');
  assert(floodChips.indexOf('68 °F') !== -1, 'temperature');
  assert(floodChips.indexOf('-63 dBm') !== -1, 'signal strength');
  assert(floodChips.indexOf('92%') !== -1, 'battery');
  const wetCard = await mountCard({ entity: 'binary_sensor.basement_flood_sensor' },
    makeHass({ states: Object.assign(baseStates(),
      { 'binary_sensor.basement_flood_sensor': st('on', { device_class: 'moisture' }) }) }));
  fh = body(wetCard.shadowRoot.innerHTML);
  assert(fh.indexOf('Water detected') !== -1, 'wet state names itself');
  assert(fh.indexOf('accent-red') !== -1, 'and turns the card red');

  group('18. Empty state');
  const empty = await mountCard({ device_id: 'no-such-device' });
  const eh = body(empty.shadowRoot.innerHTML);
  assert(eh.indexOf('No B-hyve devices found') !== -1, 'says so plainly');
  assert(eh.indexOf('class="empty"') !== -1, 'in the empty treatment');
  assert(eh.indexOf('data-section=') === -1, 'with no accordions to open');

  group('19. XSS escaping');
  const nasty = baseStates(); noFault(nasty);
  nasty['valve.garden_beds'] = st('closed',
    { station: 2, zone_name: '<img src=x onerror=alert(1)>' });
  nasty['switch.bhyve_xr_b_program'] = st('off',
    { friendly_name: '<script>alert(2)</script>', frequency: { interval: 4 } });
  const xss = await mountCard({}, makeHass({ states: nasty }));
  const xh = tapSection(xss, 'programs');
  assert(xh.indexOf('<img src=x') === -1, 'a zone name cannot inject markup');
  assert(xh.indexOf('&lt;img src=x') !== -1, 'it is escaped instead');
  assert(xh.indexOf('<script>alert(2)') === -1, 'nor can a program name');
  assert(xh.indexOf('&lt;script&gt;') !== -1, 'also escaped');
  const xssName = await mountCard(
    { zones: [{ entity: 'valve.front_lawn', name: '<b>bold</b>' }] }, makeHass({ states: nasty }));
  assert(body(xssName.shadowRoot.innerHTML).indexOf('&lt;b&gt;bold') !== -1,
    'and neither can a configured zone name override');

  group('20. Mushroom stays a soft dependency');
  assert(code.indexOf('getComputedStyle') === -1,
    'no detection probe — every RGB fallback is Mushroom’s own default');
  assert(code.indexOf('--mush-rgb-green, 76, 175, 80') !== -1, 'green falls back to Mushroom green');
  assert(code.indexOf('--mush-rgb-blue, 33, 150, 243') !== -1, 'blue falls back to Mushroom blue');
  assert(body(html).indexOf('Mushroom') === -1, 'and the card never nags about it');

  group('21. Nothing of the two-card era is left in the source');
  assert(code.indexOf("'bhyve-zone-card'") === -1, 'no zone-card element name is defined');
  assert(code.indexOf('show_smart_watering_and_programs') === -1, 'no retired zone-card option');
  assert(code.indexOf('resolveZone') === -1, 'no zone resolver');
  assert(code.indexOf('_selectProgram') === -1,
    'no single-selection program handler — v5 programs are independent switches');
  assert(code.indexOf('CARD_VERSION   = \'5.0.0\'') !== -1, 'version constant is 5.0.0');

  group('22. Optimistic state, the tick, and section persistence');
  const runHass = clean(x => {
    x['valve.front_lawn'] = st('closed', { station: 1, zone_name: 'Front Lawn' }); });
  const runCard = await mountCard({}, runHass);
  runCard.shadowRoot.querySelectorAll('[data-act]')
    .find(el => el.dataset.act === 'run' && el.dataset.entity === 'valve.front_lawn').click();
  assert(runHass.calls[0].service === 'start_watering', 'Run calls the bhyve service');
  assert(runHass.calls[0].data.minutes === 10, 'with the minutes the button showed');
  assert(runCard._pendingOn.has('valve.front_lawn'), 'and marks the zone optimistically on');
  let rh = body(runCard.shadowRoot.innerHTML);
  assert(rh.indexOf('data-act="stop" data-entity="valve.front_lawn"') !== -1,
    'the row flips to Stop before HA confirms');
  runCard.shadowRoot.querySelectorAll('[data-act]')
    .find(el => el.dataset.act === 'stop' && el.dataset.entity === 'valve.front_lawn').click();
  assert(runHass.calls[1].service === 'stop_watering', 'Stop calls the bhyve service');
  assert(runCard._pendingOff.has('valve.front_lawn'), 'and marks it optimistically off');

  const keep = await mountCard({}, clean());
  tapSection(keep, 'programs');
  keep.hass = clean();
  await flush();
  assert(keep._open.programs === true, 'an open section survives a hass update');
  assert(body(keep.shadowRoot.innerHTML).indexOf('Programs · all zones') !== -1,
    'and is still rendered after the re-render');

  assert(typeof keep.getCardSize() === 'number' && keep.getCardSize() > 0,
    'the card reports a size to the masonry layout');

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
