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
// Pretend Mushroom is installed so the dependency notice stays out of the way.
global.getComputedStyle = () => ({ getPropertyValue: () => ' 33, 150, 243 ' });
global.console = {
  info: () => {}, log: () => {},
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
      station: 1, zone_name: 'Front Lawn', manual_preset_runtime: 10,
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
  assert(code.indexOf("CARD_VERSION   = '3.0.0'") !== -1, 'version is 3.0.0');

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
  // Garden Beds is station 2, which programs A and B both target, so its
  // program rows render inline.
  assert(html.indexOf('class="rows"') !== -1, 'idle zone renders its programs inline');
  assert(html.indexOf('Program A') !== -1 && html.indexOf('Program B') !== -1,
         'idle zone lists both programs targeting its station');

  const bare = await mountZone({ entity: 'valve.garden_beds' }, makeHass({ states: (() => {
    const s = baseStates();
    s['valve.garden_beds'] = st('closed', { station: 9, zone_name: 'Garden Beds' });
    return s;
  })() }));
  assert(bare.shadowRoot.innerHTML.indexOf('class="rows"') === -1,
         'zone with no smart watering and no matching program renders no rows');

  group('4. Zone card — running');
  const running = await mountZone({ entity: 'valve.front_lawn' });
  html = running.shadowRoot.innerHTML;
  assert(/Watering · \d+:\d\d left/.test(html), 'running shows live countdown');
  assert(html.indexOf('data-act="stop"') !== -1, 'running shows Stop button');
  assert(html.indexOf('class="bar"') !== -1, 'running shows progress bar');
  assert(html.indexOf('Smart watering') !== -1, 'running renders smart watering row inline');
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
  assert(html.indexOf('short circuit') !== -1, 'banner has human-readable fault text');
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
  assert(html.indexOf('did not accept') !== -1, 'note says the device refused the preset');
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
  assert(html.indexOf('data-act="drawer"') === -1, 'no drawer when show_actions is false');
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

  group('22. Mushroom dependency notice');
  const realGCS = global.getComputedStyle;
  global.getComputedStyle = () => ({ getPropertyValue: () => '' });
  const degraded = await mountZone({ entity: 'valve.garden_beds' });
  html = degraded.shadowRoot.innerHTML;
  assert(html.indexOf('Mushroom is not installed') !== -1, 'notice shown when tokens are missing');
  assert(html.indexOf('Idle · station 2') !== -1, 'card still renders rather than refusing');
  const dismiss = degraded.shadowRoot.querySelector('.dismiss-notice');
  assert(!!dismiss, 'notice is dismissible');
  dismiss.click();
  assert(degraded.shadowRoot.innerHTML.indexOf('Mushroom is not installed') === -1,
         'dismissing hides the notice');
  global.getComputedStyle = realGCS;

  group('23. Dark-theme chip contrast');
  assert(code.indexOf('--bh-chip:    color-mix(in srgb, var(--primary-text-color)') !== -1,
         'neutral chip fill derives from the text colour, so it inverts with the theme');
  assert(/--bh-chip:\s+rgba\(/.test(code), 'a static rgba fallback precedes the color-mix value');

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
