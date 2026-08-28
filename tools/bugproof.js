'use strict';
// Demonstrates the two discovery defects on concrete registry data by running
// the old and new resolution logic side by side. No mocking of the result —
// each variant is the real code, verbatim.

const objectId = id => String(id||'').split('.').slice(1).join('.');
const matches  = (id,d,s) => String(id||'').startsWith(d+'.') && String(id||'').endsWith(s);

// ── Variant 1: first draft — "closest match wins", always returns something ──
function pickV1(candidates, zoneEntityId) {
  if (!candidates.length) return null;
  if (candidates.length === 1) return candidates[0];
  const zoneTokens = objectId(zoneEntityId).split('_').filter(Boolean);
  let best = candidates[0], bestScore = -1;
  candidates.forEach(c => {
    const tokens = objectId(c).split('_').filter(Boolean);
    const score = tokens.filter(t => zoneTokens.includes(t)).length;
    if (score > bestScore) { bestScore = score; best = c; }
  });
  return best;
}

// ── Variant 2: second draft — containment required, but a lone candidate is
//    still taken unconditionally ────────────────────────────────────────────
function pickV2(candidates, zoneEntityId) {
  if (!candidates.length) return null;
  if (candidates.length === 1) return candidates[0];          // <-- the defect
  const zoneTokens = objectId(zoneEntityId).split('_').filter(Boolean);
  if (!zoneTokens.length) return null;
  return candidates.find(c => {
    const tokens = objectId(c).split('_').filter(Boolean);
    return zoneTokens.every(t => tokens.includes(t));
  }) || null;
}

// ── Variant 3: shipped — lone candidate only when it is genuinely shared ────
function pickV3(candidates, zoneEntityId, opts) {
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

// ── Fixture A: 4-zone controller ───────────────────────────────────────────
// Deliberately realistic: only Front Lawn has a smart-watering switch, and
// Back Lawn has neither a battery nor a history sensor of its own.
const DEVICE_A = [
  'valve.front_lawn', 'valve.garden_beds', 'valve.side_strip', 'valve.back_lawn',
  'binary_sensor.front_lawn_connected', 'binary_sensor.garden_beds_connected',
  'binary_sensor.side_strip_connected',
  'sensor.front_lawn_battery_level', 'sensor.garden_beds_battery_level',
  'sensor.side_strip_battery_level',
  'sensor.front_lawn_zone_history', 'sensor.garden_beds_zone_history',
  'switch.front_lawn_smart_watering',
  'binary_sensor.bhyve_xr_fault', 'switch.bhyve_xr_rain_delay',
  'select.bhyve_xr_device_mode',
];

// ── Fixture B: single-zone hose timer ──────────────────────────────────────
const DEVICE_B = [
  'valve.backyard_faucet_zone',
  'binary_sensor.backyard_faucet_connected',
  'sensor.backyard_faucet_battery_level',
  'switch.backyard_faucet_smart_watering',
];

const KINDS = [
  ['hub',            'binary_sensor', '_connected',      true],
  ['battery',        'sensor',        '_battery_level',  true],
  ['history',        'sensor',        '_zone_history',   true],
  ['smart watering', 'switch',        '_smart_watering', true],
  ['fault',          'binary_sensor', '_fault',          false],
  ['rain delay',     'switch',        '_rain_delay',     false],
];

function report(title, ids) {
  const zones = ids.filter(i => i.startsWith('valve.'));
  const zoneCount = zones.length;
  console.log('\n' + '='.repeat(78));
  console.log(title + '  (' + zoneCount + ' zone' + (zoneCount>1?'s':'') + ')');
  console.log('='.repeat(78));

  zones.forEach(zone => {
    console.log('\n  ZONE ' + zone);
    KINDS.forEach(([label, domain, suffix, perZone]) => {
      const cands = ids.filter(i => matches(i, domain, suffix));
      if (!cands.length) return;
      const v1 = pickV1(cands, zone);
      const v2 = pickV2(cands, zone);
      const v3 = pickV3(cands, zone, {perZone, zoneCount});
      const flag = (v3 === v1 && v3 === v2) ? '   ' :
                   (v3 === null ? ' ! ' : ' * ');
      console.log(flag + '  ' + label.padEnd(15) +
        ' v1=' + String(v1).padEnd(38) +
        ' v2=' + String(v2).padEnd(38) +
        ' SHIPPED=' + v3);
    });
  });
}

report('FIXTURE A — 4-zone controller', DEVICE_A);
report('FIXTURE B — single-zone hose timer', DEVICE_B);
console.log('\nLegend:  * variant differs from shipped   ! shipped correctly returns null\n');
