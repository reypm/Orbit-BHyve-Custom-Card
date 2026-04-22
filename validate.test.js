// Headless validation — simulates browser globals, runs the IIFE, checks all exports
'use strict';
const fs = require('fs');
const code = fs.readFileSync(require('path').join(__dirname, 'bhyve-sprinkler-card.js'), 'utf8');

// ── Stub browser globals ───────────────────────────────────────────────────
global.window = { customCards: [] };
global.CustomEvent = class {
  constructor(n, o) { this.type = n; this.detail = o?.detail; }
};
global.HTMLElement = class {
  constructor() {
    this.shadowRoot = {
      innerHTML: '',
      querySelectorAll: () => [],
      getElementById:   () => null,
      querySelector:    () => null,
    };
  }
  attachShadow() { return this.shadowRoot; }
  addEventListener() {}
  dispatchEvent() {}
};
global.customElements = {
  _reg: {},
  get(n)         { return this._reg[n] || null; },
  define(n, cls) { this._reg[n] = cls; },
};
global.console = {
  info:  (...a) => process.stdout.write('[INFO] ' + a.join(' ') + '\n'),
  log:   (...a) => {},
  error: (...a) => process.stderr.write('[ERR]  ' + a.join(' ') + '\n'),
};

eval(code); // eslint-disable-line no-eval

// ── Test runner ────────────────────────────────────────────────────────────
let passed = 0;
let failed = 0;
const errors = [];

function assert(cond, msg) {
  if (cond) {
    process.stdout.write('  ✅  ' + msg + '\n');
    passed++;
  } else {
    process.stdout.write('  ❌  ' + msg + '\n');
    errors.push(msg);
    failed++;
  }
}

// ── 1. Registration ────────────────────────────────────────────────────────
process.stdout.write('\n[1] Custom element registration\n');
const Card   = customElements.get('bhyve-sprinkler-card');
const Editor = customElements.get('bhyve-sprinkler-card-editor');
assert(!!Card,   'Card element registered');
assert(!!Editor, 'Editor element registered');
assert(window.customCards.length === 1,                             'customCards entry added');
assert(window.customCards[0].type    === 'bhyve-sprinkler-card',   'customCards.type correct');
assert(window.customCards[0].preview === true,                      'customCards.preview = true');

// ── 2. Card static API ─────────────────────────────────────────────────────
process.stdout.write('\n[2] Card static API\n');
assert(typeof Card.getConfigElement === 'function', 'getConfigElement() exists');
assert(typeof Card.getStubConfig    === 'function', 'getStubConfig() exists');

// ── 3. Card instance methods ───────────────────────────────────────────────
process.stdout.write('\n[3] Card instance methods\n');
const card = new Card();
assert(typeof card.setConfig   === 'function', 'setConfig()  exists');
assert(typeof card.getCardSize === 'function', 'getCardSize() exists');
assert(typeof card._render     === 'function', '_render() exists');
assert(typeof card._tplHeader  === 'function', '_tplHeader() exists');
assert(typeof card._tplZones   === 'function', '_tplZones() exists');
assert(typeof card._tplNextRun === 'function', '_tplNextRun() exists');
assert(typeof card._tplHealth  === 'function', '_tplHealth() exists');
assert(typeof card._tplActions === 'function', '_tplActions() exists');

// ── 4. setConfig behaviour ─────────────────────────────────────────────────
process.stdout.write('\n[4] setConfig() behaviour\n');
try {
  card.setConfig({ title: 'Test', zones: [] });
  assert(true, 'accepts valid config');
} catch(e) { assert(false, 'threw on valid config: ' + e.message); }

try {
  card.setConfig(null);
  assert(false, 'should throw on null config');
} catch(e) { assert(true, 'throws on null config'); }

// Defaults applied
card.setConfig({ zones: [] });
assert(card._config.title           === 'BHyve Sprinkler', 'default title applied');
assert(card._config.columns         === 2,                 'default columns applied');
assert(card._config.show_next_run   === true,              'default show_next_run applied');
assert(card._config.show_health     === true,              'default show_health applied');
assert(card._config.show_actions    === true,              'default show_actions applied');

// ── 5. getStubConfig() — ships blank ──────────────────────────────────────
process.stdout.write('\n[5] getStubConfig()\n');
const stub = Card.getStubConfig();
assert(stub.zones.length === 0,          'ships with no zones by default');
assert(stub.battery_entity    === '',    'battery_entity empty by default');
assert(stub.rain_delay_entity === '',    'rain_delay_entity empty by default');
assert(stub.title === 'BHyve Sprinkler', 'default title set');
assert(stub.columns === 2,               'default columns = 2');

// ── 6. Template rendering ──────────────────────────────────────────────────
process.stdout.write('\n[6] Template rendering\n');
// Empty zones → empty state
const emptyHtml = card._tplZones([], 2);
assert(emptyHtml.includes('empty-state'), 'empty zones shows empty-state');
assert(emptyHtml.includes('edit'),        'empty state contains edit hint');

// Zone card with active zone
// Zone card with active zone
const mockHassOn = { states: { 'switch.bhyve_zone_1': { state: 'on', attributes: { manual_preset_runtime: 10 }, last_changed: new Date().toISOString(), last_updated: new Date().toISOString() } }};
card.setConfig({ zones: [{ entity: 'switch.bhyve_zone_1', name: 'Front', icon: 'mdi:sprinkler', run_time: 10 }] });
card._hass = mockHassOn;
const zHtml = card._tplZones(card._config.zones, 2);
assert(zHtml.includes('zone-card active'), 'active zone gets .active class');
assert(zHtml.includes('Running'),          'active zone shows Running status');
assert(zHtml.includes('Stop'),             'active zone shows Stop button');

// Inactive zone
const mockHassOff = { states: { 'switch.bhyve_zone_1': { state: 'off', attributes: {}, last_changed: new Date().toISOString(), last_updated: new Date().toISOString() } }};
card._hass = mockHassOff;
const zOffHtml = card._tplZones(card._config.zones, 2);
assert(!zOffHtml.includes('zone-card active'), 'idle zone has no active class');
assert(zOffHtml.includes('Run 10m'),        'idle zone shows Run Xm button');

// ── 7. Header rendering ────────────────────────────────────────────────────
process.stdout.write('\n[7] Header rendering\n');
card.setConfig({ title: 'My Garden', controller_name: 'Backyard Controller', zones: [] });
card._hass = { states: {} };
const hdrActive = card._tplHeader(card._config, 'active', '2 zones running', 'active');
assert(hdrActive.includes('My Garden'),              'header shows title');
assert(hdrActive.includes('Backyard Controller'),    'header shows controller name');
assert(hdrActive.includes('status-badge active'),    'header has active badge');

const hdrRain = card._tplHeader(card._config, 'rain', 'Rain delay', 'rain');
assert(hdrRain.includes('status-badge rain'),        'header has rain badge');
assert(hdrRain.includes('device-icon rain'),         'device icon has rain class');

// ── 8. getCardSize ─────────────────────────────────────────────────────────
process.stdout.write('\n[8] getCardSize()\n');
const sixZones = new Array(6).fill({ entity:'switch.x', name:'Z', icon:'mdi:sprinkler', run_time:10 });
card.setConfig({ zones: sixZones, columns: 2 });
assert(card.getCardSize() >= 5, 'getCardSize() is reasonable for 6 zones in 2 cols');
card.setConfig({ zones: sixZones, columns: 1 });
assert(card.getCardSize() > 5, 'getCardSize() larger for 1-col layout');

// ── 9. Security: XSS escaping ─────────────────────────────────────────────
process.stdout.write('\n[9] XSS escaping\n');
const xss = '<script>alert("xss")</script>';
const xssZoneHtml = card._tplZones([{ entity:'switch.x', name: xss, icon:'mdi:sprinkler', run_time:10 }], 2);
assert(!xssZoneHtml.includes('<script>'),         'zone name is HTML-escaped');
assert(!xssZoneHtml.includes('alert("xss")'),     'script content is escaped');

const xssHeaderHtml = card._tplHeader({ title: xss, controller_name: xss, zones:[] }, 'idle', 'idle', 'idle');
assert(!xssHeaderHtml.includes('<script>'),       'title is HTML-escaped');

// ── 10. Editor ─────────────────────────────────────────────────────────────
process.stdout.write('\n[10] Editor\n');
const editor = new Editor();
assert(typeof editor.setConfig   === 'function', 'setConfig() exists');
assert(typeof editor._addZone    === 'function', '_addZone() exists');
assert(typeof editor._removeZone === 'function', '_removeZone() exists');
assert(typeof editor._moveZone   === 'function', '_moveZone() exists');
assert(typeof editor._fire       === 'function', '_fire() exists');
assert(typeof editor._patch      === 'function', '_patch() exists');
assert(typeof editor._patchZone  === 'function', '_patchZone() exists');

// Editor mutation tests
const fired = [];
editor.dispatchEvent = (e) => fired.push(e.detail?.config);
editor.setConfig({ title: 'T', zones: [{ entity: 'switch.z', name: 'Z1', icon: 'mdi:sprinkler', run_time: 10 }] });

editor._addZone();
assert(editor._config.zones.length === 2, '_addZone() appends zone');

editor._removeZone(1);
assert(editor._config.zones.length === 1, '_removeZone() removes zone by index');

editor._addZone(); // idx 1
editor._addZone(); // idx 2
editor._moveZone(2, -1);
assert(editor._config.zones[1] !== editor._config.zones[2], '_moveZone() reorders zones');

editor._patchZone(0, 'name', 'Renamed');
assert(editor._config.zones[0].name === 'Renamed', '_patchZone() updates zone field');

editor._patch('title', 'Updated');
assert(editor._config.title === 'Updated', '_patch() updates top-level config');

// fired events check
assert(fired.length > 0, 'config-changed events fired');
assert(fired.every(c => c && typeof c === 'object'), 'all fired events contain config objects');

// ── 11c. _isOn valve/switch states ───────────────────────────────────────
process.stdout.write('\n[11c] _isOn() valve + optimistic\n');
{
  const card3 = new Card();
  card3._pendingOn  = new Set();
  card3._pendingOff = new Set();

  card3._hass = { states: {
    'switch.zone_on':  { state: 'on'     },
    'switch.zone_off': { state: 'off'    },
    'valve.zone_open': { state: 'open'   },
    'valve.zone_closed':{ state: 'closed'},
  }};
  card3.setConfig({ zones: [] });

  assert(card3._isOn('switch.zone_on')   === true,  '_isOn: switch on  → true');
  assert(card3._isOn('switch.zone_off')  === false, '_isOn: switch off → false');
  assert(card3._isOn('valve.zone_open')  === true,  '_isOn: valve open → true');
  assert(card3._isOn('valve.zone_closed')=== false, '_isOn: valve closed → false');

  // Optimistic states override HA state
  card3._pendingOn.add('switch.zone_off');
  assert(card3._isOn('switch.zone_off')  === true,  '_isOn: pendingOn overrides off state');
  card3._pendingOn.clear();

  card3._pendingOff.add('switch.zone_on');
  assert(card3._isOn('switch.zone_on')   === false, '_isOn: pendingOff overrides on state');
  card3._pendingOff.clear();
}

// ── 11b. _calcNextRun ─────────────────────────────────────────────────────
process.stdout.write('\n[11b] _calcNextRun()\n');
{
  // Wednesday = 3
  const now = new Date();
  const wed = 3;
  // Find next Wednesday
  const daysUntilWed = (wed - now.getDay() + 7) % 7 || 7;
  const expectedDate = new Date(now);
  expectedDate.setDate(expectedDate.getDate() + daysUntilWed);
  expectedDate.setHours(6, 0, 0, 0);

  const card2 = new Card();
  card2._hass = { states: {} };
  card2.setConfig({ zones: [], schedule_days: [wed], schedule_time: '06:00' });
  const result = card2._calcNextRun(card2._config);
  assert(result instanceof Date,              '_calcNextRun returns a Date');
  assert(result.getDay() === wed,             '_calcNextRun finds correct day of week');
  assert(result > now,                        '_calcNextRun returns a future date');
  assert(result.getHours() === 6,             '_calcNextRun uses configured hour');
  assert(result.getMinutes() === 0,           '_calcNextRun uses configured minutes');

  // Empty schedule → null
  card2.setConfig({ zones: [], schedule_days: [], schedule_time: '06:00' });
  assert(card2._calcNextRun(card2._config) === null, '_calcNextRun returns null with no days');

  // Multiple days
  card2.setConfig({ zones: [], schedule_days: [1,3,5], schedule_time: '07:30' });
  const multi = card2._calcNextRun(card2._config);
  assert(multi instanceof Date,               '_calcNextRun works with multiple days');
  assert([1,3,5].includes(multi.getDay()),    '_calcNextRun picks a configured day');
}

// ── 11. New editor methods (v1.1.0) ───────────────────────────────────────
process.stdout.write('\n[11] drag & drop + auto-detect\n');
const ed2 = new Editor();
const fired2 = [];
ed2.dispatchEvent = (e) => fired2.push(e.detail?.config);
ed2.setConfig({ zones: [
  { entity: 'switch.z1', name: 'A', icon: 'mdi:sprinkler', run_time: 10 },
  { entity: 'switch.z2', name: 'B', icon: 'mdi:sprinkler', run_time: 8  },
  { entity: 'switch.z3', name: 'C', icon: 'mdi:sprinkler', run_time: 12 },
]});

// _swapZones basic reorder
ed2._swapZones(0, 2);
assert(ed2._config.zones[0].name === 'B', '_swapZones(0,2) shifts B to front');
assert(ed2._config.zones[2].name === 'A', '_swapZones(0,2) moves A to position 2');

// _swapZones no-op when same index
const before = JSON.stringify(ed2._config.zones);
ed2._swapZones(1, 1);
assert(JSON.stringify(ed2._config.zones) === before, '_swapZones(x,x) is a no-op');

// _swapZones adjacent
ed2.setConfig({ zones: [
  { entity: 'switch.z1', name: 'A', icon: 'mdi:sprinkler', run_time: 10 },
  { entity: 'switch.z2', name: 'B', icon: 'mdi:sprinkler', run_time: 8  },
]});
ed2._swapZones(0, 1);
assert(ed2._config.zones[0].name === 'B', '_swapZones(0,1) swaps adjacent zones');

// ha-selector used (not ha-entity-picker)
assert(!code.includes('ha-entity-picker'), 'ha-entity-picker replaced by ha-selector');
assert(code.includes('ha-selector'),       'ha-selector is used for entity selection');
assert(!code.includes('_autoDetect'),      'auto-detect removed');
assert(code.includes('el.selector ='),     '_initPickers() sets .selector as DOM property');

// _bindDragDrop exists
assert(typeof ed2._bindDragDrop === 'function', '_bindDragDrop() method exists');

// Version bumped
assert(code.includes('friendly_name'), 'zone selector auto-fills name from friendly_name');

// Per-chip health toggles
assert(code.includes('show_health_battery'),   'show_health_battery toggle exists');
assert(code.includes('show_health_last_seen'), 'show_health_last_seen toggle exists');
assert(code.includes('show_health_zones'),     'show_health_zones toggle exists');

// Wifi removed
assert(!code.includes('wifi_entity'),          'wifi_entity removed from card');

// Keyboard shortcut fix
assert(code.includes("addEventListener('keydown', e => e.stopPropagation())"),
  'editor stops keydown propagation to fix HA shortcut interference');;


// ── 12. Zone card wireframe layout ───────────────────────────────
process.stdout.write('\n[12] zone card wireframe structure\n');
{
  const c4 = new Card();
  const now = new Date().toISOString();
  const hassOn  = { states: { 'switch.z1': { state: 'on',  attributes: { manual_preset_runtime: 10 }, last_changed: now, last_updated: now } } };
  const hassOff = { states: { 'switch.z1': { state: 'off', attributes: {},                           last_changed: now, last_updated: now } } };

  c4.setConfig({ zones: [{ entity: 'switch.z1', name: 'Front Lawn', run_time: 10 }] });

  // ── Idle zone layout ──
  c4._hass = hassOff;
  const idle = c4._tplZones(c4._config.zones, 1, c4._config, false);
  assert(idle.includes('zc-header'),          'idle: zc-header row present');
  assert(idle.includes('zc-name'),            'idle: zc-name element present');
  assert(idle.includes('zc-sep'),             'idle: zc-sep separator present');
  assert(idle.includes('zc-status'),          'idle: zc-status element present');
  assert(idle.includes('Idle'),               'idle: status text is Idle');
  assert(idle.includes('zc-run-btn idle'),    'idle: run button has idle class');
  assert(idle.includes('data-action="run"'),  'idle: button action is run');
  assert(idle.includes('Run 10m'),            'idle: button shows Run Xm');
  assert(!idle.includes('data-action="stop"'),'idle: no stop action present');
  assert(!idle.includes('zc-timer'),          'idle: no timer bar when not running');

  // ── Running zone layout ──
  c4._hass = hassOn;
  const running = c4._tplZones(c4._config.zones, 1, c4._config, false);
  assert(running.includes('zone-card active'),       'running: zone-card has active class');
  assert(running.includes('Running'),                'running: status text contains Running');
  assert(running.includes('zc-run-btn active'),      'running: run button has active class');
  assert(running.includes('data-action="stop"'),     'running: button action is stop');
  assert(running.includes('data-action="stop"') && running.includes('Stop'), 'running: button shows Stop');
  assert(running.includes('zc-timer'),               'running: timer bar present');
  assert(running.includes('zc-timer-fill'),          'running: timer fill present');
  assert(running.includes('width:'),                 'running: timer fill has width style');

  // ── Name and separator ──
  assert(idle.includes('Front Lawn'),         'zone name shown in header');
  assert(idle.includes('zc-sep'),             'separator | present between name and status');
}

// ── 13. Per-zone Wi-Fi hub row ──────────────────────────────────
process.stdout.write('\n[13] per-zone hub row\n');
{
  const c5 = new Card();
  const now = new Date().toISOString();

  // Zone WITH hub — hub is online
  c5._hass = { states: {
    'switch.z1':           { state: 'off', attributes: {}, last_changed: now, last_updated: now },
    'binary_sensor.hub1':  { state: 'on',  attributes: { friendly_name: 'Wi-Fi Hub Zone 1' } },
  }};
  c5.setConfig({ zones: [{ entity: 'switch.z1', name: 'Zone 1', run_time: 10, hub_entity: 'binary_sensor.hub1' }] });
  const withHub = c5._tplZones(c5._config.zones, 1, c5._config, false);
  assert(withHub.includes('zc-hub'),               'hub row rendered when hub_entity set');
  assert(withHub.includes('zc-divider'),            'divider before hub row');
  assert(withHub.includes('Wi-Fi Hub Zone 1'),      'hub friendly name shown');
  assert(withHub.includes('zc-hub-state good'),     'hub state has good class when online');
  assert(withHub.includes('>Online<'),              'hub shows Online text');
  assert(withHub.includes('mdi:wifi"'),             'wifi icon used when online');

  // Hub offline
  c5._hass = { states: {
    'switch.z1':           { state: 'off', attributes: {}, last_changed: now, last_updated: now },
    'binary_sensor.hub1':  { state: 'off', attributes: { friendly_name: 'Wi-Fi Hub Zone 1' } },
  }};
  const offlineHub = c5._tplZones(c5._config.zones, 1, c5._config, false);
  assert(offlineHub.includes('zc-hub-state bad'),   'hub state has bad class when offline');
  assert(offlineHub.includes('>Offline<'),          'hub shows Offline text');
  assert(offlineHub.includes('mdi:wifi-off'),       'wifi-off icon used when offline');

  // Zone WITHOUT hub
  c5.setConfig({ zones: [{ entity: 'switch.z1', name: 'Zone 1', run_time: 10 }] });
  c5._hass = { states: { 'switch.z1': { state: 'off', attributes: {}, last_changed: now, last_updated: now } } };
  const noHub = c5._tplZones(c5._config.zones, 1, c5._config, false);
  assert(!noHub.includes('zc-hub'),                 'hub row not rendered when no hub_entity');
}

// ── 14. Programs: zone-attr fallback (no toggles) ───────────────
process.stdout.write('\n[14] programs from zone switch attributes\n');
{
  const c6 = new Card();
  const now = new Date().toISOString();
  const progAttrs = {
    program_a: { name: 'Summer schedule', frequency: { type: 'days', days: [1,3,5] }, start_times: ['06:00'], run_times: [{ run_time: 10, station: 1 }] },
    program_e: { name: 'Smart watering', is_smart_program: true },
  };
  c6._hass = { states: {
    'switch.z1': { state: 'off', attributes: progAttrs, last_changed: now, last_updated: now },
  }};
  c6.setConfig({ zones: [{ entity: 'switch.z1', name: 'Zone 1', run_time: 10 }], show_programs: true });
  const withProgs = c6._tplZones(c6._config.zones, 1, c6._config, false);
  assert(withProgs.includes('zc-programs'),           'programs section rendered from zone attrs');
  assert(withProgs.includes('zc-prog-label'),         'programs section has label');
  assert(withProgs.includes('zc-prog-row'),           'at least one program row rendered');
  assert(withProgs.includes('Summer schedule'),       'program_a name shown');
  assert(withProgs.includes('Mon · Wed · Fri'),       'program_a days shown');
  assert(withProgs.includes('06:00'),                 'program_a start time shown');
  assert(withProgs.includes('10m'),                   'program_a run time shown');
  assert(withProgs.includes('Smart watering'),        'program_e shown');
  assert(withProgs.includes('mdi:brain'),             'brain icon shown for smart program');
  // No toggles since no program_entities
  assert(!withProgs.includes('zc-prog-toggle'),       'no toggles when program_entities not set');

  // show_programs: false hides the section
  c6.setConfig({ zones: [{ entity: 'switch.z1', name: 'Zone 1', run_time: 10 }], show_programs: false });
  const noProgs = c6._tplZones(c6._config.zones, 1, c6._config, false);
  assert(!noProgs.includes('zc-programs'),            'programs hidden when show_programs=false');
}

// ── 15. Programs: program_entities with toggles ─────────────────
process.stdout.write('\n[15] program_entities with toggles\n');
{
  const c7 = new Card();
  const now = new Date().toISOString();
  c7._hass = { states: {
    'switch.z1':        { state: 'off', attributes: {}, last_changed: now, last_updated: now },
    'switch.zone_program_a': { state: 'on',  attributes: { friendly_name: 'Summer schedule', frequency: { type:'days', days:[1,3] }, start_times:['06:00'], run_times:[{ run_time:10, station:1 }] } },
    'switch.zone_program_e': { state: 'on',  attributes: { friendly_name: 'Smart watering',  is_smart_program: true } },
    'switch.zone_program_b': { state: 'off', attributes: { friendly_name: 'Autumn schedule', frequency: { type:'days', days:[6] },   start_times:['07:00'], run_times:[{ run_time:8, station:1 }] } },
  }};
  c7.setConfig({ zones: [{
    entity: 'switch.z1', name: 'Zone 1', run_time: 10,
    program_entities: ['switch.zone_program_a', 'switch.zone_program_e', 'switch.zone_program_b'],
  }], show_programs: true });

  const withToggles = c7._tplZones(c7._config.zones, 1, c7._config, false);
  assert(withToggles.includes('zc-prog-toggle'),         'toggles rendered with program_entities');
  assert(withToggles.includes('zc-prog-toggle on'),      'on toggle for active program');
  assert(withToggles.includes('zc-prog-toggle off'),     'off toggle for inactive program');
  assert(withToggles.includes('data-prog-entity="switch.zone_program_a"'), 'prog-a entity in data attr');
  assert(withToggles.includes('data-prog-on="true"'),   'data-prog-on true for enabled program');
  assert(withToggles.includes('data-prog-on="false"'),  'data-prog-on false for disabled program');
  assert(withToggles.includes('Summer schedule'),        'program name from entity friendly_name');
  assert(withToggles.includes('Smart watering'),         'smart program name shown');
  assert(withToggles.includes('mdi:brain'),              'brain icon for is_smart_program=true');
  assert(withToggles.includes('Mon · Wed'),              'days formatted from frequency.days');
  // Program B (off) - check color derives from _b entity id
  assert(withToggles.includes('#2196F3'),                'program_b gets blue color from entity id');
}

// ── 16. Per-zone health chips ───────────────────────────────────
process.stdout.write('\n[16] per-zone health chips\n');
{
  const c8 = new Card();
  const now = new Date().toISOString();

  // Good battery (>50%)
  c8._hass = { states: {
    'switch.z1':       { state: 'off', attributes: {}, last_changed: now, last_updated: now },
    'sensor.battery1': { state: '85', attributes: {} },
  }};
  c8.setConfig({ zones: [{ entity: 'switch.z1', name: 'Zone 1', run_time: 10, battery_entity: 'sensor.battery1' }] });
  const goodBat = c8._tplZones(c8._config.zones, 1, c8._config, false);
  assert(goodBat.includes('zc-chip'),           'zc-chip rendered when battery_entity set');
  assert(goodBat.includes('zc-chip-val g'),     'good class for battery >50%');
  assert(goodBat.includes('85%'),               'battery percentage shown');
  assert(goodBat.includes('Battery'),           'Battery label shown');
  assert(goodBat.includes('Last seen'),         'Last seen chip shown from last_updated');

  // Warn battery (20-50%)
  c8._hass.states['sensor.battery1'].state = '30';
  const warnBat = c8._tplZones(c8._config.zones, 1, c8._config, false);
  assert(warnBat.includes('zc-chip-val w'),     'warn class for battery 20-50%');

  // Bad battery (<20%)
  c8._hass.states['sensor.battery1'].state = '10';
  const badBat = c8._tplZones(c8._config.zones, 1, c8._config, false);
  assert(badBat.includes('zc-chip-val b'),      'bad class for battery <20%');

  // No battery entity — health shows last-seen only
  c8.setConfig({ zones: [{ entity: 'switch.z1', name: 'Zone 1', run_time: 10 }] });
  const noBat = c8._tplZones(c8._config.zones, 1, c8._config, false);
  assert(!noBat.includes('Battery'),            'battery chip hidden when no battery_entity');
  assert(noBat.includes('Last seen'),           'last-seen chip still shown without battery');
}

// ── 17. Zone meta badges (sprinkler type + smart watering) ───────
process.stdout.write('\n[17] zone meta badges\n');
{
  const c9 = new Card();
  const now = new Date().toISOString();
  c9._hass = { states: {
    'switch.z1': { state: 'off', attributes: {
      sprinkler_type: 'rotary',
      smart_watering_enabled: true,
    }, last_changed: now, last_updated: now },
  }};
  c9.setConfig({ zones: [{ entity: 'switch.z1', name: 'Zone 1', run_time: 10 }],
    show_sprinkler_type: true, show_smart_watering: true });
  // Meta badge config fields exist in code (v2.0.0) — visual output not in wireframe layout
  assert(code.includes('show_sprinkler_type'),   'show_sprinkler_type config field exists in code');
  assert(code.includes('smart_watering_entity'), 'smart_watering_entity field exists in code');
  assert(code.includes('sprinkler_type'),        'sprinkler_type attribute read from zone entity');
  assert(code.includes('zc-sw-toggle'),           'smart watering uses entity-driven toggle (zc-sw-toggle)');
  // Type map: rotary → friendly name (code-level check)
  assert(code.includes("rotary:'Rotary'") || code.includes("rotary: 'Rotary'"), 'rotary sprinkler type has friendly name mapping');
  assert(code.includes("drip:'Drip / Soaker'") || code.includes("drip: 'Drip / Soaker'"), 'drip sprinkler type has friendly name mapping');
}

// ── 18. Actions row (Run all / Stop all) ─────────────────────────
process.stdout.write('\n[18] actions row\n');
{
  const c10 = new Card();
  c10.setConfig({ zones: [], rain_delay_entity: 'switch.rain' });
  const actWith = c10._tplActions([], false, c10._config);
  assert(actWith.includes('Run all'),           'Run all button present');
  assert(actWith.includes('Stop all'),          'Stop all button present (renamed from Pause all)');
  assert(!actWith.includes('Pause all'),        'Pause all text removed');
  assert(actWith.includes('Rain delay'),        'Rain delay button present when entity configured');
  assert(actWith.includes('data-action="run-all"'),   'run-all action attribute set');
  assert(actWith.includes('data-action="pause-all"'), 'pause-all action attribute set internally');

  // No rain entity → no rain delay button
  c10.setConfig({ zones: [] });
  const actNoRain = c10._tplActions([], false, c10._config);
  assert(!actNoRain.includes('Rain delay'),     'rain delay button absent when no rain entity');

  // Rain delay active → Cancel delay text
  c10.setConfig({ zones: [], rain_delay_entity: 'switch.rain' });
  const actRainOn = c10._tplActions([], true, c10._config);
  assert(actRainOn.includes('Cancel delay'),    'Cancel delay shown when rain delay active');
}

// ── 19. Config defaults ─────────────────────────────────────────
process.stdout.write('\n[19] config defaults\n');
{
  const c11 = new Card();
  c11.setConfig({ zones: [] });
  assert(c11._config.show_sprinkler_type !== false, 'show_sprinkler_type defaults to true');
  assert(c11._config.show_smart_watering !== false, 'show_smart_watering defaults to true');
  assert(c11._config.show_programs       !== false, 'show_programs defaults to true');
  assert(c11._config.show_hub            === false, 'show_hub defaults to false (per-zone preferred)');
  assert(Array.isArray(c11._config.schedule_days),  'schedule_days defaults to array');
  assert(c11._config.schedule_time === '06:00',      'schedule_time defaults to 06:00');
}

// ── 20. Editor: program_entities per zone ────────────────────────
process.stdout.write('\n[20] editor program_entities\n');
{
  const ed3 = new Editor();
  const fired3 = [];
  ed3.dispatchEvent = (e) => fired3.push(e.detail?.config);

  // Set up a zone with existing program entities
  ed3.setConfig({ zones: [{
    entity: 'switch.z1', name: 'Zone 1', run_time: 10,
    program_entities: ['switch.prog_a', 'switch.prog_e'],
  }]});

  // _patchZone can update program_entities
  ed3._patchZone(0, 'program_entities', ['switch.zone_program_a', 'switch.zone_program_e', 'switch.zone_program_b']);
  assert(ed3._config.zones[0].program_entities.length === 3, '_patchZone updates program_entities list');
  assert(ed3._config.zones[0].program_entities[2] === 'switch.zone_program_b', 'new program entity added correctly');

  // Removing a program entity
  ed3._patchZone(0, 'program_entities', ['switch.zone_program_a', 'switch.zone_program_e']);
  assert(ed3._config.zones[0].program_entities.length === 2, 'program entity removed correctly');

  // Multiple zones each have independent program_entities
  ed3.setConfig({ zones: [
    { entity: 'switch.z1', name: 'Zone 1', run_time: 10, program_entities: ['switch.z1_prog_a'] },
    { entity: 'switch.z2', name: 'Zone 2', run_time: 10, program_entities: ['switch.z2_prog_a', 'switch.z2_prog_e'] },
  ]});
  assert(ed3._config.zones[0].program_entities.length === 1, 'zone 1 has 1 program entity');
  assert(ed3._config.zones[1].program_entities.length === 2, 'zone 2 has 2 program entities independently');

  // Editor HTML contains program entity management elements
  assert(code.includes('zone-prog-sel'),     'zone-prog-sel class in editor');
  assert(code.includes('add-prog-btn'),      'add-prog-btn in editor');
  assert(code.includes('remove-prog'),       'remove-prog button in editor');
  assert(code.includes('data-prog-idx'),     'data-prog-idx attribute in editor');

  // bhyve services used
  assert(code.includes('stop_watering'),     'bhyve.stop_watering service used');
  assert(code.includes('enable_rain_delay'), 'bhyve.enable_rain_delay service used');
  assert(code.includes('disable_rain_delay'),'bhyve.disable_rain_delay service used');
}


// ── 21. _nextOccurrence() ───────────────────────────────────────
process.stdout.write('\n[21] _nextOccurrence()\n');
{
  const cn = new Card();
  cn._hass = { states: {} };
  cn.setConfig({ zones: [] });
  const now = new Date();

  // Use a day 3 days from now to avoid any midnight/hour-wrap issues.
  // At a fixed safe time (10:00) which is never "now".
  const d3 = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 3, 10, 0, 0, 0);
  const targetDay = d3.getDay();

  const r1 = cn._nextOccurrence([targetDay], ['10:00']);
  assert(r1 instanceof Date,                        '_nextOccurrence returns a Date');
  assert(r1 > now,                                  '_nextOccurrence returns future date');
  assert(r1.getDay() === targetDay,                 '_nextOccurrence correct day of week');
  assert(r1.getHours() === 10,                      '_nextOccurrence correct hour');
  assert(r1.getMinutes() === 0,                     '_nextOccurrence correct minutes');

  // A past time on a past day-of-week → advances to same weekday next occurrence
  // Use 3-days-ago weekday at 01:00 (guaranteed past)
  const d3ago = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 3, 1, 0, 0, 0);
  const pastDay = d3ago.getDay();
  const r2 = cn._nextOccurrence([pastDay], ['01:00']);
  assert(r2 instanceof Date,                        '_nextOccurrence skips past time → future');
  assert(r2 > now,                                  '_nextOccurrence skipped result is future');

  // Multiple start times on a future day — picks earliest time
  // Use 5 days from now so no wrap risk; give 3 times, verify 09:00 is picked over 11:00
  const d5 = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 5, 12, 0, 0, 0);
  const futDay = d5.getDay();
  const r3 = cn._nextOccurrence([futDay], ['11:00', '09:00', '13:00']);
  assert(r3 instanceof Date,                        'multiple times: returns Date');
  assert(r3.getHours() === 9,                       'multiple times: picks earliest time (09:00)');
  assert(r3.getMinutes() === 0,                     'multiple times: correct minutes for earliest');

  // Multiple times where first is earlier day, second is next occurrence
  // Day 2 days from now at 09:00 vs 4 days from now at 06:00 — 2 days wins
  const d2 = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 2);
  const d4 = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 4);
  // Build a days array that contains both weekdays (may be same if d2.day === d4.day)
  const days2and4 = [...new Set([d2.getDay(), d4.getDay()])];
  // Both times are future-safe at 09:00 and 06:00 — for the SAME day set, 06:00 wins
  const r4 = cn._nextOccurrence(days2and4, ['09:00', '06:00']);
  assert(r4 instanceof Date,                        'two-time two-day: returns Date');
  assert(r4 > now,                                  'two-time two-day: result is future');

  // Empty days → null
  assert(cn._nextOccurrence([], ['06:00']) === null,  'empty days → null');
  assert(cn._nextOccurrence([1], [])       === null,  'empty times → null');
  assert(cn._nextOccurrence(null, ['06:00']) === null, 'null days → null');
}

// ── 22. _calcZoneNextRun() from program_entities ────────────────
process.stdout.write('\n[22] _calcZoneNextRun() program_entities\n');
{
  const cn2 = new Card();
  const now = new Date();
  // Use a day 4 days from now at a fixed safe time — avoids all midnight issues
  const futureDay = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 4);
  const futDayOfWeek = futureDay.getDay();
  // prog_a: 4 days from now at 06:00 (enabled)
  // prog_b: 4 days from now at 06:00 (disabled — state: off)

  cn2._hass = { states: {
    'switch.zone1': { state: 'off', attributes: {}, last_changed: now.toISOString(), last_updated: now.toISOString() },
    'switch.prog_a': {
      state: 'on',
      attributes: {
        friendly_name: 'Summer(Jun-Aug)',
        frequency: { type: 'days', days: [futDayOfWeek] },
        start_times: ['06:00'],
        run_times: [{ run_time: 10, station: 1 }],
      },
    },
    'switch.prog_b': {
      state: 'off',
      attributes: {
        friendly_name: 'Spring(Mar-May)',
        frequency: { type: 'days', days: [futDayOfWeek] },
        start_times: ['06:00'],
      },
    },
  }};
  cn2.setConfig({ zones: [{
    entity: 'switch.zone1', name: 'Zone 1', run_time: 10,
    program_entities: ['switch.prog_a', 'switch.prog_b'],
  }] });

  const zone = cn2._config.zones[0];
  const res = cn2._calcZoneNextRun(zone, cn2._config);
  assert(res !== null,                          '_calcZoneNextRun returns result');
  assert(res.date instanceof Date,              '_calcZoneNextRun result has date');
  assert(res.label === 'Summer(Jun-Aug)',        '_calcZoneNextRun uses friendly_name as label');
  assert(res.date > now,                        '_calcZoneNextRun date is in the future');
  assert(res.date.getDay() === futDayOfWeek,    '_calcZoneNextRun correct weekday');
  assert(res.label !== 'Spring(Mar-May)',        'disabled program_entity excluded from next run');
}

// ── 23. _calcZoneNextRun() from zone switch attrs ───────────────
process.stdout.write('\n[23] _calcZoneNextRun() zone attr fallback\n');
{
  const cn3 = new Card();
  const now = new Date();
  // program_a: 3 days from now at 06:00 (sooner)
  // program_e: 5 days from now at 06:00 (later)
  const d3 = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 3);
  const d5 = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 5);
  const day3 = d3.getDay();
  const day5 = d5.getDay();

  cn3._hass = { states: {
    'switch.zone1': {
      state: 'off',
      attributes: {
        program_a: {
          name: 'Summer(Jun-Aug)',
          frequency: { type: 'days', days: [day3] },
          start_times: ['06:00'],
          run_times: [{ run_time: 10, station: 1 }],
        },
        program_e: {
          name: 'Smart watering',
          is_smart_program: true,
          // Use day5 only if different from day3, else push 1 more day
          frequency: { type: 'days', days: [day5 !== day3 ? day5 : (day5+1)%7] },
          start_times: ['06:00'],
        },
      },
      last_changed: now.toISOString(),
      last_updated: now.toISOString(),
    },
  }};
  cn3.setConfig({ zones: [{ entity: 'switch.zone1', name: 'Zone 1', run_time: 10 }], show_programs: true });

  const zone = cn3._config.zones[0];
  const res = cn3._calcZoneNextRun(zone, cn3._config);
  assert(res !== null,                              'zone attr fallback returns result');
  assert(res.date instanceof Date,                  'zone attr fallback result has date');
  assert(res.label === 'Summer(Jun-Aug)',            'zone attr fallback uses program name');
  assert(res.date.getDay() === day3,                'zone attr fallback picks soonest program (day3)');

  // No programs at all → card-level schedule fallback
  cn3._hass.states['switch.zone1'].attributes = {};
  cn3.setConfig({ zones: [{ entity:'switch.zone1', name:'Zone 1', run_time:10 }],
    schedule_days: [2], schedule_time: '06:00' });
  const fallback = cn3._calcZoneNextRun(cn3._config.zones[0], cn3._config);
  assert(fallback !== null,                         'card schedule fallback returns result');
  assert(fallback.date.getDay() === 2,              'card schedule fallback picks Tuesday');
}

// ── 24. "all programs ran today" → next is 7 days away ──────────
process.stdout.write('\n[24] all start times passed today → next week\n');
{
  const cn4 = new Card();
  const now = new Date();
  // Use yesterday's day-of-week with past times — guaranteed to be in the past
  // so the engine must advance to same weekday next week
  const yesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
  const passedDay = yesterday.getDay();

  cn4._hass = { states: {
    'switch.zone1': { state:'off', attributes:{}, last_changed:now.toISOString(), last_updated:now.toISOString() },
    'switch.prog_a': {
      state: 'on',
      attributes: {
        friendly_name: 'Summer(Jun-Aug)',
        frequency: { type:'days', days:[passedDay] },
        start_times: ['02:00', '04:00'],   // always past on any day
        run_times: [{ run_time:10, station:1 }],
      },
    },
  }};
  cn4.setConfig({ zones: [{ entity:'switch.zone1', name:'Zone 1', run_time:10,
    program_entities:['switch.prog_a'] }] });

  const res = cn4._calcZoneNextRun(cn4._config.zones[0], cn4._config);
  assert(res !== null,                                'past day: still returns a result');
  assert(res.date instanceof Date,                    'past day: result has date');
  assert(res.date > now,                              'past day: date is future');
  assert(res.date.getDay() === passedDay,             'past day: same weekday next occurrence');
  const dayDiff = Math.round((res.date - now) / (24*60*60*1000));
  assert(dayDiff >= 5 && dayDiff <= 8,               'past day: within 5-8 days (next occurrence)');
}

// ── 25. per-zone schedule / display / rain ─────────────────────
process.stdout.write('\n[25] per-zone schedule, display toggles, rain delay\n');
{
  const now = new Date();
  const iso = now.toISOString();

  // --- Per-zone schedule overrides card-level ---
  const cz = new Card();
  const d5 = new Date(now.getFullYear(), now.getMonth(), now.getDate()+5);
  const d3 = new Date(now.getFullYear(), now.getMonth(), now.getDate()+3);
  cz._hass = { states: { 'switch.z1': { state:'off', attributes:{}, last_changed:iso, last_updated:iso } }};
  cz.setConfig({
    zones: [{ entity:'switch.z1', name:'Z1', run_time:10,
              schedule_days:[d5.getDay()], schedule_time:'09:00' }],
    schedule_days: [d3.getDay()], schedule_time:'06:00',
  });
  const res = cz._calcZoneNextRun(cz._config.zones[0], cz._config);
  assert(res !== null,                             'per-zone schedule: returns result');
  assert(res.date.getDay() === d5.getDay(),        'per-zone schedule_days overrides card-level');
  assert(res.date.getHours() === 9,               'per-zone schedule_time (09:00) overrides card-level');

  // --- Card-level schedule used when zone has none ---
  cz.setConfig({
    zones: [{ entity:'switch.z1', name:'Z1', run_time:10 }],
    schedule_days: [d3.getDay()], schedule_time:'06:00',
  });
  const res2 = cz._calcZoneNextRun(cz._config.zones[0], cz._config);
  assert(res2 !== null,                            'card-level schedule fallback: returns result');
  assert(res2.date.getDay() === d3.getDay(),       'card-level schedule_days used when zone has none');

  // --- Per-zone rain delay overrides card-level ---
  const cz2 = new Card();
  cz2._hass = { states: {
    'switch.z1':      { state:'off', attributes:{}, last_changed:iso, last_updated:iso },
    'switch.rain_z1': { state:'on',  attributes:{ hours_remaining: 24 } },
    'switch.rain_card':{ state:'off', attributes:{} },
  }};
  cz2.setConfig({
    zones: [{ entity:'switch.z1', name:'Z1', run_time:10,
              rain_delay_entity:'switch.rain_z1' }],
    rain_delay_entity: 'switch.rain_card',
  });
  const zoneHtml = cz2._tplZones(cz2._config.zones, 1, cz2._config, false);
  assert(zoneHtml.includes('zc-rain-pill'),        'per-zone rain delay: pill shown when zone entity active');
  assert(zoneHtml.includes('24 hr delay'),          'per-zone rain delay: hours_remaining shown');

  // --- Per-zone display toggles ---
  const cz3 = new Card();
  cz3._hass = { states: { 'switch.z1': { state:'off', attributes:{
    sprinkler_type:'rotary', smart_watering_enabled: true,
    program_a:{ name:'Summer', frequency:{ days:[2] }, start_times:['06:00'], run_times:[{ run_time:10 }] }
  }, last_changed:iso, last_updated:iso }}};

  // show_programs false on zone hides programs
  cz3.setConfig({ zones:[{ entity:'switch.z1', name:'Z1', run_time:10, show_programs:false }] });
  const noProgs = cz3._tplZones(cz3._config.zones, 1, cz3._config, false);
  assert(!noProgs.includes('zc-programs'),         'zone show_programs:false hides programs section');

  // show_programs true on zone shows programs even if card-level is false (zone wins)
  cz3.setConfig({ zones:[{ entity:'switch.z1', name:'Z1', run_time:10, show_programs:true }], show_programs:false });
  const yesProgs = cz3._tplZones(cz3._config.zones, 1, cz3._config, false);
  assert(yesProgs.includes('zc-programs'),         'zone show_programs:true overrides card-level false');

  // --- Editor has per-zone sub-sections ---
  assert(code.includes('zone-day-btn'),             'editor: zone-day-btn in zone row');
  assert(code.includes('zone-time-sel'),            'editor: zone-time-sel in zone row');
  assert(code.includes('zone-rain-sel'),            'editor: zone-rain-sel in zone row');
  assert(code.includes('zone-toggle'),              'editor: zone-toggle in zone row');
  assert(code.includes('data-zone-key'),            'editor: data-zone-key attribute');
  assert(!code.includes('schedule-time-sel'),       'global schedule-time-sel removed');
  assert(!code.includes('data-key="show_sprinkler_type"'), 'global show_sprinkler_type toggle removed');
  assert(!code.includes('data-key="show_programs"'),       'global show_programs toggle removed');

  // --- hasRainDelay includes per-zone entities ---
  assert(code.includes("zs.some(z => z.rain_delay_entity && this._isOn(z.rain_delay_entity))"),
         'hasRainDelay checks per-zone rain_delay_entity');

  // --- Global actions shows rain button when any zone has rain entity ---
  assert(code.includes("(zones||[]).some(z=>!!z.rain_delay_entity)"),
         '_tplActions shows rain button when zones have rain entity');
}

// ── 26. smart_watering_entity toggle ────────────────────────────
process.stdout.write('\n[26] smart_watering_entity toggle\n');
{
  const now = new Date().toISOString();
  const cw = new Card();
  cw._hass = { states: {
    'switch.z1':   { state:'off', attributes:{}, last_changed:now, last_updated:now },
    'switch.sw1':  { state:'on',  attributes:{ friendly_name:'Smart Watering Zone 1' } },
  }};
  cw.setConfig({ zones:[{ entity:'switch.z1', name:'Z1', run_time:10,
                           smart_watering_entity:'switch.sw1' }] });

  const html = cw._tplZones(cw._config.zones, 1, cw._config, false);
  assert(html.includes('zc-settings'),              'Settings section rendered');
  assert(html.includes('zc-settings-label'),        'Settings label present');
  assert(html.includes('zc-setting-row'),           'Setting row present');
  assert(html.includes('Smart Watering Zone 1'),    'friendly_name shown in Settings');
  assert(html.includes('mdi:brain'),                'brain icon in Settings');
  assert(html.includes('zc-sw-toggle on'),          'toggle on when entity state=on');
  assert(html.includes('data-sw-entity="switch.sw1"'), 'sw-entity data attr set');
  assert(html.includes('data-sw-on="true"'),        'data-sw-on true for on entity');

  // Toggle off when entity is off
  cw._hass.states['switch.sw1'].state = 'off';
  const html2 = cw._tplZones(cw._config.zones, 1, cw._config, false);
  assert(html2.includes('zc-sw-toggle off'),        'toggle off when entity state=off');
  assert(html2.includes('data-sw-on="false"'),      'data-sw-on false for off entity');

  // No smart_watering_entity → no Settings section
  cw.setConfig({ zones:[{ entity:'switch.z1', name:'Z1', run_time:10 }] });
  const html3 = cw._tplZones(cw._config.zones, 1, cw._config, false);
  assert(!html3.includes('zc-settings'),            'Settings section hidden when no entity');

  // Editor and bindings
  assert(code.includes('zone-sw-sel'),              'zone-sw-sel in editor');
  assert(code.includes('smart_watering_entity'),    'smart_watering_entity field used');
  assert(code.includes('zc-sw-toggle'),             'zc-sw-toggle CSS class');
  assert(code.includes('data-sw-entity'),           'data-sw-entity attr in template');
  assert(!code.includes('show_smart_watering') || code.includes('show_smart_watering ?? true'),
         'show_smart_watering removed from global meta check');
}
// ── Summary ───────────────────────────────────────────────────────────────
process.stdout.write('\n─────────────────────────────────────────\n');
// ── Summary ───────────────────────────────────────────────────────────────
process.stdout.write('\n─────────────────────────────────────────\n');
process.stdout.write(`Results: ${passed} passed, ${failed} failed\n`);
if (failed > 0) {
  process.stdout.write('Failed tests:\n');
  errors.forEach(e => process.stdout.write('  • ' + e + '\n'));
  process.exit(1);
} else {
  process.stdout.write('✅ All tests passed!\n');
}
