// =============================================================================
// BHyve Sprinkler Card for Home Assistant
// Version: 1.0.0
// Repository: https://github.com/reypm/Orbit-BHyve-Custom-Card
// =============================================================================

(function () {
  'use strict';

  const CARD_VERSION = '1.0.0';
  const CARD_TYPE    = 'bhyve-sprinkler-card';
  const EDITOR_TYPE  = 'bhyve-sprinkler-card-editor';

  // ---------------------------------------------------------------------------
  // CSS — Card
  // ---------------------------------------------------------------------------
  const CARD_STYLES = `
    /* ── HA palette tokens — fallbacks match HA 2023+ defaults ── */
    :host {
      display: block;
      --_success:  var(--success-color,  #4CAF50);
      --_warning:  var(--warning-color,  #FF9800);
      --_error:    var(--error-color,    #F44336);
      --_primary:  var(--primary-color,  #03a9f4);
      --_s-rgb:    var(--rgb-success-color,  76, 175,  80);
      --_p-rgb:    var(--rgb-primary-color,   3, 169, 244);
      --_w-rgb:    var(--rgb-warning-color, 255, 152,   0);
      --_e-rgb:    var(--rgb-error-color,   244,  67,  54);
    }

    ha-card {
      overflow: hidden;
      font-family: var(--paper-font-body1_-_font-family,
                       var(--primary-font-family, sans-serif));
    }

    /* ── Status accent bar ─────────────────────────────── */
    .status-bar {
      height: 4px;
      background: transparent;
      transition: background .3s ease;
    }
    .status-bar.active { background: var(--_success); }
    .status-bar.rain   { background: var(--_primary); }

    /* ── Header ─────────────────────────────────────── */
    .card-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 14px 16px 12px;
      border-bottom: 1px solid var(--divider-color);
      transition: background .3s ease;
    }
    .card-header.active { background: rgba(var(--_s-rgb), .05); }
    .card-header.rain   { background: rgba(var(--_p-rgb), .05); }
    .header-left { display: flex; align-items: center; gap: 10px; }
    .device-icon {
      width: 36px; height: 36px;
      border-radius: 8px;
      display: flex; align-items: center; justify-content: center;
      background: rgba(var(--_s-rgb), .12);
      color: var(--_success);
      flex-shrink: 0;
    }
    .device-icon.rain { background: rgba(var(--_p-rgb), .12); color: var(--_primary); }
    .device-icon.idle { background: var(--secondary-background-color); color: var(--secondary-text-color); }

    .card-title {
      font-size: 14px; font-weight: 500;
      color: var(--primary-text-color);
      line-height: 1.3;
    }
    .card-subtitle {
      font-size: 12px; color: var(--secondary-text-color);
      margin-top: 1px; line-height: 1.3;
    }

    .status-badge {
      font-size: 11px; font-weight: 500;
      padding: 3px 10px; border-radius: 99px;
      white-space: nowrap; flex-shrink: 0;
    }
    .status-badge.active { background: rgba(var(--_s-rgb), .15); color: var(--_success); }
    .status-badge.rain   { background: rgba(var(--_p-rgb), .15); color: var(--_primary); }
    .status-badge.idle   { background: var(--secondary-background-color); color: var(--secondary-text-color); }

    /* ── Sections ───────────────────────────────────── */
    .section { padding: 14px 16px 16px; }
    .section + .section, .section + .actions-row { border-top: 1px solid var(--divider-color); }
    .section-label {
      font-size: 11px; font-weight: 500;
      letter-spacing: .07em; text-transform: uppercase;
      color: var(--secondary-text-color);
      margin-bottom: 10px;
    }

    /* ── Empty state ─────────────────────────────────── */
    .empty-state {
      padding: 28px 16px;
      text-align: center;
      color: var(--secondary-text-color);
    }
    .empty-state ha-icon { --mdc-icon-size: 40px; opacity: .35; }
    .empty-state p { font-size: 13px; margin: 8px 0 0; line-height: 1.5; }

    /* ── Zone tray & grid ────────────────────────────── */
    .zone-section {
      background: rgba(var(--_p-rgb), .05);
      border-radius: 12px;
      padding: 9px;
    }
    .zone-grid { display: grid; gap: 9px; }

    /* ── Zone card — wireframe layout ────────────────── */
    .zone-card {
      border-radius: 10px;
      border: 1px solid var(--divider-color);
      background: var(--card-background-color, #fff);
      overflow: hidden;
      transition: border-color .2s;
    }
    .zone-card.active { border-color: rgba(var(--_s-rgb), .5); }

    /* Header row: "Name | Status"  [Run/Stop btn] */
    .zc-header {
      display: flex; align-items: center;
      padding: 12px 14px; gap: 10px;
    }
    .zc-title-row {
      flex: 1; display: flex; align-items: center;
      gap: 7px; min-width: 0; flex-wrap: wrap;
    }
    .zc-name {
      font-size: 14px; font-weight: 600;
      color: var(--primary-text-color);
      white-space: nowrap;
    }
    .zc-sep { color: var(--divider-color); font-size: 14px; }
    .zc-status {
      font-size: 13px; color: var(--secondary-text-color);
      white-space: nowrap;
    }
    .zone-card.active .zc-status { color: var(--_success); font-weight: 500; }

    /* Run / Stop toggle button */
    .zc-run-btn {
      padding: 7px 16px; border-radius: 8px; border: none;
      font-size: 13px; font-weight: 600; cursor: pointer; flex-shrink: 0;
      transition: background .15s, transform .1s;
    }
    .zc-run-btn.idle { background: var(--_primary); color: #fff; }
    .zc-run-btn.active { background: var(--_error, #f44336); color: #fff; }
    .zc-run-btn:active { transform: scale(.96); }

    /* Timer progress bar */
    .zc-timer {
      height: 3px; background: rgba(var(--_s-rgb), .18);
      overflow: hidden;
    }
    .zc-timer-fill {
      height: 100%; background: var(--_success);
      border-radius: 0 2px 2px 0;
      transition: width 60s linear;
    }

    /* Section dividers inside card */
    .zc-divider { height: 1px; background: var(--divider-color); }

    /* Hub row */
    .zc-hub {
      display: flex; align-items: center;
      gap: 10px; padding: 10px 14px;
    }
    .zc-hub ha-icon {
      --mdc-icon-size: 18px;
      color: var(--secondary-text-color);
    }
    .zc-hub ha-icon.good { color: var(--_success); }
    .zc-hub ha-icon.bad  { color: var(--_error, #f44336); }
    .zc-hub-name {
      flex: 1; font-size: 13px; font-weight: 500;
      color: var(--primary-text-color); min-width: 0;
    }
    .zc-hub-state {
      font-size: 12px; font-weight: 500;
      color: var(--secondary-text-color); flex-shrink: 0;
    }
    .zc-hub-state.good { color: var(--_success); }
    .zc-hub-state.bad  { color: var(--_error, #f44336); }

    /* Settings section (Smart watering toggle) */
    .zc-settings { padding: 8px 14px 10px; }
    .zc-settings-label {
      font-size: 10px; font-weight: 700;
      letter-spacing: .07em; text-transform: uppercase;
      color: var(--secondary-text-color); margin-bottom: 6px;
    }
    .zc-setting-row {
      display: flex; align-items: center; gap: 10px; padding: 5px 0;
    }
    .zc-setting-name {
      flex: 1; font-size: 12.5px; font-weight: 500;
      color: var(--primary-text-color);
    }
    .zc-setting-name ha-icon { --mdc-icon-size: 14px; vertical-align: middle; }
    .zc-sw-toggle {
      width: 40px; height: 22px; border-radius: 11px; flex-shrink: 0;
      position: relative; cursor: pointer; border: none; transition: background .2s;
    }
    .zc-sw-toggle.on  { background: var(--_primary); }
    .zc-sw-toggle.off { background: var(--secondary-text-color); opacity: .4; }
    .zc-sw-toggle-knob {
      width: 16px; height: 16px; border-radius: 50%; background: #fff;
      position: absolute; top: 3px; transition: left .15s;
      box-shadow: 0 1px 3px rgba(0,0,0,.25);
    }
    .zc-sw-toggle.on  .zc-sw-toggle-knob { left: 21px; }
    .zc-sw-toggle.off .zc-sw-toggle-knob { left: 3px; }
    .zc-sw-toggle:active { opacity: .8; }

    /* Programs section */
    .zc-programs { padding: 10px 14px 6px; }
    .zc-prog-label {
      font-size: 10.5px; font-weight: 700;
      letter-spacing: .07em; text-transform: uppercase;
      color: var(--secondary-text-color); margin-bottom: 7px;
    }
    .zc-prog-row {
      display: flex; align-items: center; gap: 9px;
      padding: 6px 0;
      border-bottom: 0.5px solid var(--divider-color);
    }
    .zc-prog-row:last-child { border-bottom: none; padding-bottom: 3px; }
    .zc-prog-dot {
      width: 9px; height: 9px; border-radius: 50%; flex-shrink: 0;
    }
    .zc-prog-info { flex: 1; min-width: 0; }
    .zc-prog-name {
      font-size: 12.5px; font-weight: 500;
      color: var(--primary-text-color);
      display: flex; align-items: center; gap: 4px;
    }
    .zc-prog-meta {
      font-size: 10.5px; font-weight: 400;
      color: var(--secondary-text-color);
    }
    .zc-prog-label-sep { opacity: .4; }
    .zc-prog-sched {
      font-size: 11px; color: var(--secondary-text-color); margin-top: 1px;
    }

    /* Pill toggle for programs */
    .zc-prog-toggle {
      width: 40px; height: 22px; border-radius: 11px; flex-shrink: 0;
      position: relative; cursor: pointer; border: none;
      transition: background .2s; padding: 0; background: #ccc;
    }
    .zc-prog-toggle.on  { background: var(--_primary); }
    .zc-prog-toggle.off { background: var(--secondary-text-color); opacity: .4; }
    .zc-prog-toggle-knob {
      width: 16px; height: 16px; border-radius: 50%; background: #fff;
      position: absolute; top: 3px;
      transition: left .15s;
      box-shadow: 0 1px 3px rgba(0,0,0,.25);
    }
    .zc-prog-toggle.on  .zc-prog-toggle-knob { left: 21px; }
    .zc-prog-toggle.off .zc-prog-toggle-knob { left: 3px; }
    .zc-prog-toggle:active { opacity: .8; }

    /* Health chips */
    .zc-health {
      display: flex; gap: 8px;
      padding: 10px 14px 12px;
    }
    .zc-chip {
      flex: 1; display: flex; flex-direction: column;
      align-items: center; gap: 3px;
      padding: 10px 6px; border-radius: 8px;
      background: var(--secondary-background-color);
    }
    .zc-chip ha-icon { --mdc-icon-size: 19px; color: var(--secondary-text-color); }
    .zc-chip ha-icon.g { color: var(--_success); }
    .zc-chip ha-icon.w { color: var(--_warning, #ff9800); }
    .zc-chip ha-icon.b { color: var(--_error, #f44336); }
    .zc-chip-val {
      font-size: 13px; font-weight: 700; color: var(--primary-text-color);
    }
    .zc-chip-val.g { color: var(--_success); }
    .zc-chip-val.w { color: var(--_warning, #ff9800); }
    .zc-chip-val.b { color: var(--_error, #f44336); }
    .zc-chip-lbl { font-size: 11px; color: var(--secondary-text-color); }

    /* Footer: next run + rain pill */
    .zc-footer {
      padding: 7px 14px 9px;
      border-top: 1px solid var(--divider-color);
      display: flex; align-items: center; gap: 6px; flex-wrap: wrap;
    }
    .zc-next {
      flex: 1; font-size: 11px; color: var(--secondary-text-color);
      min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
    }
    .zc-rain-pill {
      font-size: 10px; font-weight: 500;
      padding: 2px 7px; border-radius: 99px;
      background: rgba(var(--_p-rgb), .12); color: var(--_primary);
      white-space: nowrap; flex-shrink: 0;
    }

    /* ── Next run ─────────────────────────────────────── */
    .next-run-row {
      display: flex; align-items: center;
      justify-content: space-between; gap: 12px;
    }
    .next-run-info { flex: 1; min-width: 0; }
    .next-run-label { font-size: 12px; color: var(--secondary-text-color); margin-bottom: 3px; }
    .next-run-time  { font-size: 16px; font-weight: 500; color: var(--primary-text-color); }
    .next-run-na    { font-size: 13px; color: var(--secondary-text-color); font-style: italic; }

    .rain-chip {
      flex-shrink: 0; padding: 8px 12px;
      border-radius: 8px; text-align: center;
      background: var(--secondary-background-color);
      border: 0.5px solid var(--divider-color);
      min-width: 84px;
    }
    .rain-chip.active {
      background: rgba(var(--_p-rgb), .1);
      border-color: rgba(var(--_p-rgb), .4);
    }
    .rain-chip-label { font-size: 11px; color: var(--secondary-text-color); }
    .rain-chip.active .rain-chip-label { color: var(--_primary); }
    .rain-chip-value { font-size: 14px; font-weight: 500; color: var(--primary-text-color); margin-top: 2px; }
    .rain-chip.active .rain-chip-value { color: var(--_primary); }

    /* ── Health chips ─────────────────────────────────── */
    .health-row { display: flex; gap: 8px; flex-wrap: wrap; }
    .health-chip {
      flex: 1; min-width: 60px;
      display: flex; flex-direction: column; align-items: center;
      gap: 3px; padding: 8px 6px;
      border-radius: 8px;
      background: var(--secondary-background-color);
    }
    .health-chip ha-icon { --mdc-icon-size: 18px; color: var(--secondary-text-color); }
    .health-chip ha-icon.good { color: var(--_success); }
    .health-chip ha-icon.warn { color: var(--_warning); }
    .health-chip ha-icon.bad  { color: var(--_error); }
    .health-value { font-size: 13px; font-weight: 500; color: var(--primary-text-color); }
    .health-value.good { color: var(--_success); }
    .health-value.warn { color: var(--_warning); }
    .health-value.bad  { color: var(--_error); }
    .health-label { font-size: 11px; color: var(--secondary-text-color); }

    /* ── Wi-Fi hub (global section — kept for backward compat) ─── */
    .hub-row {
      display: flex; align-items: center; gap: 12px;
      padding: 10px 12px; border-radius: 8px;
      background: var(--secondary-background-color);
    }
    .hub-icon { --mdc-icon-size: 22px; color: var(--secondary-text-color); }
    .hub-icon.good { color: var(--_success); }
    .hub-icon.bad  { color: var(--_error); }
    .hub-name { flex: 1; font-size: 13px; font-weight: 500; color: var(--primary-text-color); }
    .hub-state { font-size: 12px; font-weight: 500; color: var(--secondary-text-color); }
    .hub-state.good { color: var(--_success); }
    .hub-state.bad  { color: var(--_error); }

    /* ── Actions ──────────────────────────────────────── */
    .actions-row {
      display: flex; gap: 8px;
      padding: 10px 16px 14px;
    }
    .action-btn {
      flex: 1;
      display: flex; align-items: center;
      justify-content: center; gap: 5px;
      padding: 9px 8px; border-radius: 8px;
      border: 0.5px solid var(--divider-color);
      background: var(--secondary-background-color);
      font-size: 12px; font-weight: 500;
      color: var(--primary-text-color);
      cursor: pointer; white-space: nowrap;
    }
    .action-btn ha-icon { --mdc-icon-size: 16px; }
    .action-btn.primary {
      background: rgba(var(--_s-rgb), .1);
      border-color: rgba(var(--_s-rgb), .4);
      color: var(--_success);
    }
    .action-btn.rain-active {
      background: rgba(var(--_p-rgb), .1);
      border-color: rgba(var(--_p-rgb), .4);
      color: var(--_primary);
    }
    .action-btn:hover { opacity: .85; }
    .action-btn:active { transform: scale(.98); }
  `;

  // ---------------------------------------------------------------------------
  // CSS — Editor
  // ---------------------------------------------------------------------------
  const EDITOR_STYLES = `
    :host { display: block; padding: 0 16px 16px; }

    .editor-section { margin-bottom: 20px; }
    .editor-section-title {
      font-size: 11px; font-weight: 600;
      letter-spacing: .08em; text-transform: uppercase;
      color: var(--secondary-text-color);
      padding: 6px 0 8px;
      border-bottom: 1px solid var(--divider-color);
      margin-bottom: 14px;
    }

    .field-row { display: flex; flex-direction: column; gap: 3px; margin-bottom: 12px; }
    .field-row:last-child { margin-bottom: 0; }
    .field-label { font-size: 12px; color: var(--secondary-text-color); font-weight: 500; }
    .field-hint     { font-size: 11px; color: var(--secondary-text-color); opacity: .8; margin-top: 1px; }
    .field-optional { font-size: 11px; font-weight: 400; color: var(--secondary-text-color); opacity: .7; }

    .entity-group-label {
      font-size: 10px; font-weight: 700;
      letter-spacing: .07em; text-transform: uppercase;
      color: var(--secondary-text-color); opacity: .7;
      margin: 12px 0 6px;
    }
    .entity-group-label:first-child { margin-top: 0; }

    /* Shared input styling */
    .ha-input {
      width: 100%; box-sizing: border-box;
      border: 1px solid var(--divider-color);
      border-radius: 6px; padding: 8px 10px;
      background: var(--primary-background-color);
      color: var(--primary-text-color);
      font-size: 13px; font-family: inherit;
    }
    .ha-input:focus { outline: none; border-color: var(--primary-color, #03a9f4); }

    /* ha-selector renders native HA entity picker rows */
    ha-selector { display: block; }

    /* Day-of-week picker */
    .day-picker { display: flex; gap: 5px; flex-wrap: wrap; margin-top: 4px; }
    .day-btn {
      padding: 5px 9px; border-radius: 6px;
      border: 1px solid var(--divider-color);
      background: none; cursor: pointer;
      font-size: 12px; font-weight: 500;
      color: var(--secondary-text-color); font-family: inherit;
    }
    .day-btn.active {
      background: var(--primary-color, #03a9f4);
      border-color: var(--primary-color, #03a9f4);
      color: #fff;
    }
    .schedule-preview {
      margin-top: 6px; padding: 8px 10px; border-radius: 6px;
      background: var(--secondary-background-color);
      font-size: 12px; color: var(--secondary-text-color);
    }
    .schedule-preview strong { color: var(--primary-text-color); }

    /* Toggle row */
    .toggle-row {
      display: flex; align-items: center;
      justify-content: space-between; padding: 6px 0;
    }
    .toggle-label { font-size: 13px; color: var(--primary-text-color); }
    .toggle-switch { position: relative; width: 36px; height: 20px; flex-shrink: 0; }
    .toggle-switch input { opacity: 0; width: 0; height: 0; }
    .toggle-slider {
      position: absolute; cursor: pointer; inset: 0;
      border-radius: 10px; background: var(--divider-color); transition: .2s;
    }
    .toggle-slider:before {
      content: ''; position: absolute;
      width: 14px; height: 14px; left: 3px; bottom: 3px;
      background: white; border-radius: 50%; transition: .2s;
    }
    .toggle-switch input:checked + .toggle-slider { background: var(--primary-color, #03a9f4); }
    .toggle-switch input:checked + .toggle-slider:before { transform: translateX(16px); }

    /* Zone rows */
    .zone-row {
      display: flex; align-items: flex-start; gap: 8px;
      padding: 10px; margin-bottom: 8px;
      border-radius: 8px;
      border: 1px solid var(--divider-color);
      background: var(--secondary-background-color);
      transition: opacity .15s, border-color .15s;
    }
    .zone-row.dragging { opacity: .3; }
    .zone-row.drag-over {
      border-color: var(--primary-color, #03a9f4);
      outline: 2px dashed var(--primary-color, #03a9f4);
      outline-offset: -2px;
    }

    .zone-drag-handle {
      cursor: grab; flex-shrink: 0;
      color: var(--secondary-text-color);
      padding: 4px 2px; opacity: .6;
      display: flex; align-items: center;
    }
    .zone-drag-handle:hover { opacity: 1; }
    .zone-drag-handle:active { cursor: grabbing; }

    .zone-fields { flex: 1; display: flex; flex-direction: column; gap: 6px; }
    .zone-inline { display: flex; gap: 8px; align-items: center; }
    .zone-inline .ha-input { flex: 1; }

    .zone-actions { display: flex; flex-direction: column; gap: 4px; flex-shrink: 0; }

    .icon-btn {
      background: none; border: none; cursor: pointer;
      padding: 4px; border-radius: 4px;
      color: var(--secondary-text-color);
      display: flex; align-items: center; line-height: 1;
    }
    .icon-btn:hover { background: var(--divider-color); }
    .icon-btn.danger { color: var(--error-color, #F44336); }
    .icon-btn:disabled { opacity: .3; cursor: not-allowed; }

    .add-zone-btn {
      width: 100%; padding: 10px; border-radius: 8px;
      border: 1px dashed var(--divider-color);
      background: none; cursor: pointer;
      color: var(--primary-color, #03a9f4);
      font-size: 13px; font-weight: 500; font-family: inherit;
      display: flex; align-items: center; justify-content: center; gap: 6px;
    }
    .add-zone-btn:hover { background: var(--secondary-background-color); }



    /* ha-form native rendering inside editor */
    ha-form { display: block; }
  `;

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------
  function _escHtml(str) {
    return String(str || '')
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function _elapsed(dateStr) {
    try {
      const mins = Math.round((Date.now() - new Date(dateStr)) / 60000);
      if (mins < 1) return 'just now';
      if (mins < 60) return `${mins}m`;
      return `${Math.floor(mins / 60)}h ${mins % 60}m`;
    } catch(e) { return '—'; }
  }

  function _formatNext(dateStr) {
    try {
      const ts = new Date(dateStr);
      if (isNaN(ts.getTime())) return dateStr;
      return ts.toLocaleString('en-US', {
        weekday: 'long', hour: 'numeric', minute: '2-digit',
      });
    } catch(e) { return dateStr; }
  }

  // ---------------------------------------------------------------------------
  // Main Card
  // ---------------------------------------------------------------------------
  class BhyveSprinklerCard extends HTMLElement {
    constructor() {
      super();
      this.attachShadow({ mode: 'open' });
      this._config    = null;
      this._hass      = null;
      this._pendingOn  = new Set(); // optimistic "running" entities
      this._pendingOff = new Set(); // optimistic "stopped" entities
    }

    // ── HA lifecycle ──────────────────────────────────────────────
    static getConfigElement() {
      return document.createElement(EDITOR_TYPE);
    }

    static getStubConfig() {
      // Ship blank — user configures everything through the UI editor
      return {
        title:            'BHyve Sprinkler',
        controller_name:  'Smart Controller',
        zones:            [],
        columns:          2,
        show_next_run:    true,
        show_health:      true,
        show_actions:     true,
        battery_entity:   '',
        rain_delay_entity:'',
        next_run_entity:  '',
        hub_entity:       '',
        schedule_days:    [],
        schedule_time:    '06:00',
      };
    }

    setConfig(config) {
      if (!config) throw new Error('[bhyve-sprinkler-card] Invalid configuration.');
      this._config = {
        title:                'BHyve Sprinkler',
        controller_name:      'Smart Controller',
        zones:                [],
        columns:              2,
        show_next_run:        true,
        show_health:          true,
        show_actions:         true,
        hub_entity:        '',
        show_hub:          false,
        rain_delay_entity: '',
        schedule_days:     [],
        schedule_time:     '06:00',
        ...config,
      };
      if (this._hass) this._render();
    }

    set hass(hass) {
      this._hass = hass;
      // Clear optimistic flags once HA confirms the real state
      if (this._pendingOn.size || this._pendingOff.size) {
        this._pendingOn.forEach(id => {
          const s = hass.states[id]?.state;
          if (s === 'on' || s === 'open') this._pendingOn.delete(id);
        });
        this._pendingOff.forEach(id => {
          const s = hass.states[id]?.state;
          if (s === 'off' || s === 'closed') this._pendingOff.delete(id);
        });
      }
      this._render();
    }

    getCardSize() {
      const zones = this._config?.zones?.length || 0;
      const rows  = Math.ceil(zones / (this._config?.columns || 2));
      return 3 + rows * 2;
    }

    // ── State helpers ─────────────────────────────────────────────
    _st(id) {
      return (id && this._hass) ? (this._hass.states[id] || null) : null;
    }
    // Returns true for switch(on), valve(open), or any optimistic pending state
    _isOn(id) {
      if (!id) return false;
      if (this._pendingOn.has(id))  return true;
      if (this._pendingOff.has(id)) return false;
      const state = this._st(id)?.state;
      return state === 'on' || state === 'open';
    }
    // Resolves to the correct "turn on" service for switch vs valve
    _startEntity(entity) {
      const domain = entity?.split('.')?.[0];
      if (this._hass?.services?.bhyve?.start_watering) {
        // bhyve integration service (works for both switch and valve)
        return;  // called separately with minutes below
      }
      if (domain === 'valve') {
        this._svc('valve', 'open_valve', { entity_id: entity });
      } else {
        this._svc('homeassistant', 'turn_on', { entity_id: entity });
      }
    }
    _stopEntity(entity) {
      if (this._hass?.services?.bhyve?.stop_watering) {
        this._svc('bhyve', 'stop_watering', { entity_id: entity });
      } else {
        const domain = entity?.split('.')?.[0];
        if (domain === 'valve') {
          this._svc('valve', 'close_valve', { entity_id: entity });
        } else {
          this._svc('homeassistant', 'turn_off', { entity_id: entity });
        }
      }
    }
    _runZone(entity, minutes) {
      this._pendingOn.add(entity);
      this._pendingOff.delete(entity);
      // Fire the service first, then defer the DOM rebuild to the next
      // animation frame.  Calling _render() synchronously inside a click
      // handler replaces the shadow DOM while the browser is still
      // dispatching the event; the browser then re-fires the click on
      // whatever new element lands at the same coordinates ("phantom click"),
      // causing the state to toggle back immediately.
      if (this._hass?.services?.bhyve?.start_watering) {
        this._svc('bhyve', 'start_watering', { entity_id: entity, minutes });
      } else {
        this._startEntity(entity);
      }
      requestAnimationFrame(() => this._render());
      // Safety clear after 15 s in case HA never confirms
      setTimeout(() => { this._pendingOn.delete(entity); this._render(); }, 15000);
    }
    _stopZone(entity) {
      this._pendingOff.add(entity);
      this._pendingOn.delete(entity);
      this._stopEntity(entity);
      requestAnimationFrame(() => this._render());
      setTimeout(() => { this._pendingOff.delete(entity); this._render(); }, 8000);
    }
    _attr(id, key, fallback = null) {
      return this._st(id)?.attributes?.[key] ?? fallback;
    }
    _svc(domain, service, data) {
      this._hass?.callService(domain, service, data);
    }

    // ── Next-run calculator ───────────────────────────────────────
    // ── _nextOccurrence ──────────────────────────────────────────
    // Given an array of weekday indices (0=Sun) and an array of
    // "HH:MM" start time strings, returns the earliest future Date.
    // If today is a watering day but all start times have already
    // passed, it advances to the same day next week.
    _nextOccurrence(days, startTimes) {
      if (!days?.length || !startTimes?.length) return null;
      const now  = new Date();
      const nowT = now.getTime();
      let   best = null;

      for (const timeStr of startTimes) {
        const raw   = String(timeStr).trim();
        const clean = raw.replace(/\s*(am|pm)\s*/i, '');
        const parts = clean.split(':').map(Number);
        if (parts.length < 2 || isNaN(parts[0]) || isNaN(parts[1])) continue;
        let [h, m] = parts;
        if (/am/i.test(raw) && h === 12) h = 0;
        if (/pm/i.test(raw) && h !== 12) h += 12;

        for (let offset = 0; offset <= 14; offset++) {
          const candidate = new Date(
            now.getFullYear(), now.getMonth(), now.getDate() + offset,
            h, m, 0, 0
          );
          if (days.includes(candidate.getDay()) && candidate.getTime() > nowT) {
            if (!best || candidate.getTime() < best.getTime()) best = candidate;
            break;
          }
        }
      }
      return best;
    }

    // ── _calcZoneNextRun ─────────────────────────────────────────
    // Per-zone next-run calculator. Priority:
    //   1. Enabled program_entities (real switch state + attrs)
    //   2. program_a/b/c/e attrs on zone switch entity (read-only)
    //   3. Card-level schedule_days + schedule_time fallback
    // Returns { date: Date, label: string } | null
    _calcZoneNextRun(zone, c) {
      const candidates = []; // { date, label }

      // ── Source 1: program_entities ─────────────────────────────
      for (const progId of (zone.program_entities || [])) {
        const pSt = this._st(progId);
        if (!pSt || pSt.state !== 'on') continue; // skip disabled programs
        const attrs = pSt.attributes || {};
        const days  = attrs.frequency?.days;
        const times = attrs.start_times
          ? (Array.isArray(attrs.start_times) ? attrs.start_times : [attrs.start_times])
          : null;
        if (!days?.length || !times?.length) continue;
        const d = this._nextOccurrence(days, times);
        if (d) candidates.push({ date: d, label: attrs.friendly_name || progId });
      }

      // ── Source 2: program_x attrs on zone switch ───────────────
      if (!candidates.length) {
        const zAttrs = this._st(zone.entity)?.attributes || {};
        for (const letter of ['a','b','c','e']) {
          const prog = zAttrs[`program_${letter}`];
          if (!prog) continue;
          // Treat program as "enabled" if it has a frequency (bhyve doesn't expose on/off here)
          const days  = prog.frequency?.days;
          const times = prog.start_times
            ? (Array.isArray(prog.start_times) ? prog.start_times : [prog.start_times])
            : null;
          if (!days?.length || !times?.length) continue;
          const d = this._nextOccurrence(days, times);
          const isSmart = letter === 'e' || !!prog.is_smart_program;
          const label = prog.name || (isSmart ? 'Smart watering' : `Program ${letter.toUpperCase()}`);
          if (d) candidates.push({ date: d, label });
        }
      }

      // ── Source 3: per-zone or card-level schedule fallback ──────
      if (!candidates.length) {
        const days = zone.schedule_days?.length ? zone.schedule_days : c?.schedule_days;
        const time = zone.schedule_time || c?.schedule_time;
        if (days?.length && time) {
          const d = this._nextOccurrence(days, [time]);
          if (d) candidates.push({ date: d, label: '' });
        }
      }

      // ── Fallback: next_run_entity sensor ──────────────────────
      if (!candidates.length) {
        const nrSt = this._st(c?.next_run_entity);
        if (nrSt && !['unavailable','unknown',''].includes(nrSt.state)) {
          try {
            const ts = new Date(nrSt.state);
            if (!isNaN(ts.getTime()) && ts > new Date()) {
              return { date: ts, label: _escHtml(nrSt.attributes?.program_name || '') };
            }
          } catch(e) {}
        }
      }

      if (!candidates.length) return null;
      // Return the soonest upcoming run across all enabled programs
      candidates.sort((a, b) => a.date - b.date);
      return candidates[0];
    }

    // Keep _calcNextRun for backward compat (used by _tplNextRun global section)
    _calcNextRun(c) {
      const nrSt = this._st(c?.next_run_entity);
      if (nrSt && !['unavailable','unknown',''].includes(nrSt.state)) {
        try {
          const ts = new Date(nrSt.state);
          if (!isNaN(ts.getTime()) && ts > new Date()) return ts;
        } catch(e) {}
      }
      const days = c?.schedule_days;
      const time = c?.schedule_time;
      if (!days?.length || !time) return null;
      const d = this._nextOccurrence(days, [time]);
      return d || null;
    }

    // ── Render ────────────────────────────────────────────────────
    _render() {
      if (!this._config) return;
      const c  = this._config;
      const zs = c.zones || [];

      const active = zs.filter(z => this._isOn(z.entity)).length;
      const hasRainDelay = this._isOn(c.rain_delay_entity) ||
        zs.some(z => z.rain_delay_entity && this._isOn(z.rain_delay_entity));

      const activeZones = zs.filter(z => this._isOn(z.entity));
      let statusClass = 'idle', statusText = 'All idle';
      if (hasRainDelay) {
        statusClass = 'rain'; statusText = 'Rain delay';
      } else if (activeZones.length === 1) {
        statusClass = 'active';
        statusText  = _escHtml(activeZones[0].name || 'Zone running');
      } else if (activeZones.length > 1) {
        statusClass = 'active';
        statusText  = `${activeZones.length} zones running`;
      }

      this.shadowRoot.innerHTML = `
        <style>${CARD_STYLES}</style>
        <ha-card>
          <div class="status-bar ${statusClass}"></div>
          ${this._tplHeader(c, statusClass, statusText, activeZones.length)}
          ${this._tplZones(zs, c.columns || 2, c, hasRainDelay)}
          ${c.show_hub      !== false ? this._tplHub(c) : ''}
          ${c.show_health   !== false ? this._tplHealth(c) : ''}
          ${c.show_actions  !== false ? this._tplActions(zs, hasRainDelay, c) : ''}
        </ha-card>
      `;

      this._bindEvents();
    }

    _tplHeader(c, statusClass, statusText, active) {
      let subtitle = _escHtml(c.controller_name || 'Smart Controller');
      if (active > 0) subtitle += ` · ${active} zone${active > 1 ? 's' : ''} running`;

      return `
        <div class="card-header ${statusClass}">
          <div class="header-left">
            <div class="device-icon ${statusClass}">
              <ha-icon icon="mdi:sprinkler-variant"></ha-icon>
            </div>
            <div>
              <div class="card-title">${_escHtml(c.title || 'BHyve Sprinkler')}</div>
              <div class="card-subtitle">${subtitle}</div>
            </div>
          </div>
          <div class="status-badge ${statusClass}">${statusText}</div>
        </div>
      `;
    }

    _tplZones(zones, columns, c, hasRainDelay) {
      if (!zones.length) {
        return `
          <div class="section empty-state">
            <ha-icon icon="mdi:sprinkler-variant"></ha-icon>
            <p>No zones configured.<br>
               Click the <strong>✏️ edit</strong> button to add your BHyve zones.</p>
          </div>
        `;
      }

      const DAYS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

      const cards = zones.map((zone, i) => {
        const isOn    = this._isOn(zone.entity);
        const st      = this._st(zone.entity);
        const sClass  = isOn ? 'active' : '';
        const runTime = zone.run_time ?? this._attr(zone.entity, 'manual_preset_runtime', 10);
        const name    = _escHtml(zone.name || `Zone ${i + 1}`);

        // ── Header: status text ──────────────────────────
        let statusTxt = 'Idle';
        let timerHTML = '';
        if (isOn && st?.last_changed) {
          const elapsedMins = Math.round((Date.now() - new Date(st.last_changed)) / 60000);
          statusTxt = `Running · ${elapsedMins}m elapsed`;
          const pct = Math.min(Math.round((elapsedMins / (runTime || 10)) * 100), 100);
          timerHTML = `<div class="zc-timer"><div class="zc-timer-fill" style="width:${pct}%"></div></div>`;
        }

        // ── Per-zone rain delay ───────────────────────────
        const zoneRainEnt    = zone.rain_delay_entity || c?.rain_delay_entity || '';
        const zoneRainActive = this._isOn(zoneRainEnt);
        const zoneRdSt  = zoneRainEnt ? this._st(zoneRainEnt) : null;
        const zoneRdHrs = zoneRdSt?.attributes?.hours_remaining ??
          (zoneRainActive ? '48' : null);

        // ── Wi-Fi hub row ────────────────────────────────
        let hubHTML = '';
        if (zone.hub_entity) {
          const hubSt = this._st(zone.hub_entity);
          const raw   = (hubSt?.state || '').toLowerCase();
          const on    = ['on','home','connected','online','ok'].includes(raw);
          const off   = ['off','away','disconnected','offline','unavailable'].includes(raw);
          const hCls  = on ? 'good' : off ? 'bad' : '';
          const hTxt  = on ? 'Online' : off ? 'Offline' : _escHtml(hubSt?.state || '—');
          const hIco  = off ? 'mdi:wifi-off' : 'mdi:wifi';
          const hNam  = _escHtml(hubSt?.attributes?.friendly_name || zone.hub_entity);
          hubHTML = `
            <div class="zc-divider"></div>
            <div class="zc-hub">
              <ha-icon icon="${hIco}" class="${hCls}"></ha-icon>
              <span class="zc-hub-name">${hNam}</span>
              <span class="zc-hub-state ${hCls}">${hTxt}</span>
            </div>`;
        }

        // ── Programs ─────────────────────────────────────
        // Source 1: per-zone program_entities (have real on/off toggles)
        // Source 2: program_x attributes on zone switch (read-only schedule info)
        let programsHTML = '';
        if ((zone.show_programs ?? c?.show_programs) !== false) {
          const progRows = [];
          const PROG_COLORS = { a:'#4CAF50', b:'#2196F3', c:'#FF9800', e:'#9C27B0' };

          // Source 1 — program switch entities (with toggles)
          (zone.program_entities || []).forEach(progEntId => {
            const pSt   = this._st(progEntId);
            if (!pSt) return;
            const pOn   = pSt.state === 'on';
            const attrs = pSt.attributes || {};
            const isSmart = !!attrs.is_smart_program;
            const pName = _escHtml(attrs.friendly_name || progEntId);
            const days  = attrs.frequency?.days;
            const schedParts = [];
            if (Array.isArray(days) && days.length) schedParts.push(days.map(d => DAYS[d]).join(' · '));
            const st0 = attrs.start_times;
            if (st0) schedParts.push(Array.isArray(st0) ? st0[0] : st0);
            const rtMins = (attrs.run_times || []).reduce((s,r) => s+(r.run_time||0), 0);
            if (rtMins) schedParts.push(`${rtMins}m`);
            const sched = schedParts.join(' · ') || (isSmart ? 'Smart schedule' : '');
            // color: derive from entity id letter
            const letter = progEntId.match(/_program_([a-z])/i)?.[1]?.toLowerCase() || 'a';
            const color  = PROG_COLORS[letter] || '#4CAF50';
            const smartBadge = isSmart ? `<ha-icon icon="mdi:brain" style="--mdc-icon-size:11px;color:${PROG_COLORS.e}"></ha-icon>` : '';
            progRows.push(`
              <div class="zc-prog-row">
                <div class="zc-prog-dot" style="background:${color}"></div>
                <div class="zc-prog-info">
                  <div class="zc-prog-name">${smartBadge}${pName}</div>
                  ${sched ? `<div class="zc-prog-sched">${_escHtml(sched)}</div>` : ''}
                </div>
                <button class="zc-prog-toggle ${pOn ? 'on' : 'off'}"
                  data-prog-entity="${_escHtml(progEntId)}"
                  data-prog-on="${pOn}">
                  <div class="zc-prog-toggle-knob"></div>
                </button>
              </div>`);
          });

          // Source 2 — zone switch attributes (if no program entities, read-only)
          if (!progRows.length) {
            const zAttrs = st?.attributes || {};
            for (const letter of ['a','b','c','e']) {
              const prog = zAttrs[`program_${letter}`];
              if (!prog) continue;
              const isSmart = letter === 'e' || !!prog.is_smart_program;
              const pName  = _escHtml(prog.name || (isSmart ? 'Smart watering' : `Program ${letter.toUpperCase()}`));
              const schedParts = [];
              const days = prog.frequency?.days;
              if (Array.isArray(days) && days.length) schedParts.push(days.map(d => DAYS[d]).join(' · '));
              const st0 = prog.start_times;
              if (st0) schedParts.push(Array.isArray(st0) ? st0[0] : st0);
              const rtMins = (prog.run_times || []).reduce((s,r) => s+(r.run_time||0), 0);
              if (rtMins) schedParts.push(`${rtMins}m`);
              const sched = schedParts.join(' · ') || (isSmart ? 'Smart schedule' : '');
              const color = PROG_COLORS[letter];
              const smartBadge = isSmart ? `<ha-icon icon="mdi:brain" style="--mdc-icon-size:11px;color:${PROG_COLORS.e}"></ha-icon>` : '';
              progRows.push(`
                <div class="zc-prog-row">
                  <div class="zc-prog-dot" style="background:${color}"></div>
                  <div class="zc-prog-info">
                    <div class="zc-prog-name">${smartBadge}${pName}</div>
                    ${sched ? `<div class="zc-prog-sched">${_escHtml(sched)}</div>` : ''}
                  </div>
                </div>`);
            }
          }

          const showType = (zone.show_sprinkler_type ?? c?.show_sprinkler_type) !== false;
          if (progRows.length || showType) {
            const zAttrs = st?.attributes || {};
            const metaParts = [];
            if (showType && zAttrs.sprinkler_type) {
              const typeMap = {
                fixed:'Fixed spray', rotary:'Rotary', rotor:'Rotor',
                drip:'Drip / Soaker', impact:'Impact', flood:'Flood',
                micro_drip:'Micro drip', bubbler:'Bubbler',
              };
              metaParts.push(_escHtml(typeMap[zAttrs.sprinkler_type] || zAttrs.sprinkler_type));
            }
            const metaHint = metaParts.length
              ? `<span class="zc-prog-meta">${metaParts.join(' · ')}</span>` : '';
            if (progRows.length) {
              programsHTML = `
                <div class="zc-divider"></div>
                <div class="zc-programs">
                  <div class="zc-prog-label">Programs${metaHint ? ' <span class="zc-prog-label-sep">·</span> ' + metaHint : ''}</div>
                  ${progRows.join('')}
                </div>`;
            }
          }
        }

        // ── Settings (smart watering entity toggle) ──────
        let settingsHTML = '';
        if (zone.smart_watering_entity) {
          const swSt  = this._st(zone.smart_watering_entity);
          const swOn  = swSt?.state === 'on';
          const swLbl = _escHtml(swSt?.attributes?.friendly_name || 'Smart watering');
          settingsHTML = `
            <div class="zc-divider"></div>
            <div class="zc-settings">
              <div class="zc-settings-label">Settings</div>
              <div class="zc-setting-row">
                <span class="zc-setting-name">
                  <ha-icon icon="mdi:brain"></ha-icon> ${swLbl}
                </span>
                <button class="zc-sw-toggle ${swOn ? 'on' : 'off'}"
                  data-sw-entity="${_escHtml(zone.smart_watering_entity)}"
                  data-sw-on="${swOn}">
                  <div class="zc-sw-toggle-knob"></div>
                </button>
              </div>
            </div>`;
        }

        // ── Health chips (battery + last seen) ───────────
        const chips = [];
        if (zone.battery_entity) {
          const bSt = this._st(zone.battery_entity);
          if (bSt) {
            const n   = parseInt(bSt.state) || 0;
            const cls = n > 50 ? 'g' : n > 20 ? 'w' : 'b';
            const ico = n > 70 ? 'mdi:battery-high' : n > 30 ? 'mdi:battery-medium' : 'mdi:battery-low';
            chips.push(`<div class="zc-chip">
              <ha-icon icon="${ico}" class="${cls}"></ha-icon>
              <span class="zc-chip-val ${cls}">${n}%</span>
              <span class="zc-chip-lbl">Battery</span>
            </div>`);
          }
        }
        {
          const lastUpd = st?.last_updated;
          const ls = !lastUpd ? null :
            (() => {
              const mins = Math.round((Date.now() - new Date(lastUpd)) / 60000);
              return mins < 2 ? 'Just now' : mins < 60 ? `${mins}m ago` : `${Math.floor(mins/60)}h ago`;
            })();
          if (ls) chips.push(`<div class="zc-chip">
            <ha-icon icon="mdi:clock-check-outline"></ha-icon>
            <span class="zc-chip-val">${ls}</span>
            <span class="zc-chip-lbl">Last seen</span>
          </div>`);
        }
        const healthHTML = chips.length ? `
          <div class="zc-divider"></div>
          <div class="zc-health">${chips.join('')}</div>` : '';

        // ── Footer: next run (per-zone, from program schedule) ───
        let footerHTML = '';
        {
          const zoneNext = this._calcZoneNextRun(zone, c);
          const rainPill = zoneRainActive
            ? `<span class="zc-rain-pill">🌧 ${zoneRdHrs ? zoneRdHrs + ' hr delay' : 'Rain delay'}</span>` : '';
          let nextText = '';
          if (zoneNext) {
            const dateStr = zoneNext.date.toLocaleString('en-US', {
              weekday:'short', month:'short', day:'numeric',
              hour:'numeric', minute:'2-digit',
            });
            const safeLabel = _escHtml(zoneNext.label || '');
            nextText = safeLabel ? `${dateStr} via ${safeLabel}` : dateStr;
          }
          if (nextText || rainPill) {
            footerHTML = `<div class="zc-footer">
              ${nextText ? `<span class="zc-next">Next: ${_escHtml(nextText)}</span>` : ''}
              ${rainPill}
            </div>`;
          }
        }

        return `
          <div class="zone-card ${sClass}">
            <div class="zc-header">
              <div class="zc-title-row">
                <span class="zc-name">${name}</span>
                <span class="zc-sep">|</span>
                <span class="zc-status">${statusTxt}</span>
              </div>
              <button class="zc-run-btn ${isOn ? 'active' : 'idle'}"
                data-entity="${_escHtml(zone.entity)}"
                data-action="${isOn ? 'stop' : 'run'}"
                data-run-time="${runTime}">
                ${isOn ? 'Stop' : `Run ${runTime}m`}
              </button>
            </div>
            ${timerHTML}
            ${hubHTML}
            ${programsHTML}
            ${settingsHTML}
            ${healthHTML}
            ${footerHTML}
          </div>`;
      }).join('');

      return `
        <div class="section">
          <div class="section-label">Zones</div>
          <div class="zone-section">
            <div class="zone-grid" style="grid-template-columns:repeat(${columns},minmax(0,1fr))">
              ${cards}
            </div>
          </div>
        </div>
      `;
    }

        _tplNextRun(c, hasRainDelay) {
      const rdSt  = this._st(c.rain_delay_entity);
      const rdHrs = rdSt?.attributes?.hours_remaining ?? (hasRainDelay ? '48' : null);

      // Total runtime = sum of all configured zone run_times
      const totalMins = (c.zones || []).reduce((s, z) => s + (z.run_time || 10), 0);

      const nextRun = this._calcNextRun(c);
      let timeContent;
      if (nextRun) {
        const formatted = nextRun.toLocaleString('en-US', {
          weekday: 'long', month: 'short', day: 'numeric',
          hour: 'numeric', minute: '2-digit',
        });
        const detail = totalMins > 0
          ? `${(c.zones || []).length} zone${(c.zones||[]).length!==1?'s':''} · ${totalMins} min total`
          : '';
        timeContent = `
          <div class="next-run-time">${_escHtml(formatted)}</div>
          ${detail ? `<div class="next-run-label">${_escHtml(detail)}</div>` : ''}`;
      } else {
        const msg = (c.schedule_days?.length || c.next_run_entity)
          ? 'Checking schedule…'
          : 'Set a schedule in card settings';
        timeContent = `<div class="next-run-na">${msg}</div>`;
      }

      return `
        <div class="section">
          <div class="section-label">Next run</div>
          <div class="next-run-row">
            <div class="next-run-info">${timeContent}</div>
            <div class="rain-chip ${hasRainDelay ? 'active' : ''}">
              <div class="rain-chip-label">Rain delay</div>
              <div class="rain-chip-value">
                ${hasRainDelay ? `${rdHrs ?? '—'} hrs` : 'None'}
              </div>
            </div>
          </div>
        </div>
      `;
    }

    _tplHub(c) {
      const hubSt = this._st(c.hub_entity);
      if (!hubSt && !c.hub_entity) return '';
      const raw = (hubSt?.state || '').toLowerCase();
      const online  = ['on','home','connected','online','ok'].includes(raw);
      const offline = ['off','away','disconnected','offline','unavailable','unknown'].includes(raw);
      const stateClass = online ? 'good' : offline ? 'bad' : '';
      const stateText  = online ? 'Online' : offline ? 'Offline'
                         : _escHtml(hubSt?.state || '—');
      const icon = offline ? 'mdi:wifi-off' : 'mdi:wifi';
      const name = _escHtml(hubSt?.attributes?.friendly_name || c.hub_entity || 'Wi-Fi Hub');
      return `
        <div class="section">
          <div class="section-label">Wi-Fi hub</div>
          <div class="hub-row">
            <ha-icon icon="${icon}" class="hub-icon ${stateClass}"></ha-icon>
            <span class="hub-name">${name}</span>
            <span class="hub-state ${stateClass}">${stateText}</span>
          </div>
        </div>
      `;
    }

    _tplHealth(c) {
      const chips = [];

      // Battery chip
      if (c.show_health_battery !== false) {
        const batSt = this._st(c.battery_entity);
        if (batSt) {
          const n   = parseInt(batSt.state) || 0;
          const cls = n > 50 ? 'good' : n > 20 ? 'warn' : 'bad';
          const ico = n > 70 ? 'mdi:battery-high' : n > 30 ? 'mdi:battery-medium' : 'mdi:battery-low';
          chips.push(`
            <div class="health-chip">
              <ha-icon icon="${ico}" class="${cls}"></ha-icon>
              <span class="health-value ${cls}">${n}%</span>
              <span class="health-label">Battery</span>
            </div>`);
        }
      }

      // Last-seen chip
      if (c.show_health_last_seen !== false) {
        const zStates = (c.zones || []).map(z => this._st(z.entity)).filter(Boolean);
        let lastSeen = '—';
        if (zStates.length) {
          const latest = zStates.reduce((a, s) => {
            const t = new Date(s.last_updated);
            return t > a ? t : a;
          }, new Date(0));
          const mins = Math.round((Date.now() - latest) / 60000);
          lastSeen = mins < 2 ? 'Just now' : mins < 60 ? `${mins}m ago` : `${Math.floor(mins/60)}h ago`;
        }
        chips.push(`
          <div class="health-chip">
            <ha-icon icon="mdi:clock-check-outline"></ha-icon>
            <span class="health-value">${lastSeen}</span>
            <span class="health-label">Last seen</span>
          </div>`);
      }

      // Zone count chip
      if (c.show_health_zones !== false) {
        chips.push(`
          <div class="health-chip">
            <ha-icon icon="mdi:format-list-numbered"></ha-icon>
            <span class="health-value">${(c.zones || []).length}</span>
            <span class="health-label">Zones</span>
          </div>`);
      }

      if (!chips.length) return '';
      return `
        <div class="section">
          <div class="section-label">Device health</div>
          <div class="health-row">
            ${chips.join('')}
          </div>
        </div>
      `;
    }

    _tplActions(zones, hasRainDelay, c) {
      const hasRainEntity = !!c.rain_delay_entity ||
        (zones||[]).some(z=>!!z.rain_delay_entity);
      return `
        <div class="actions-row">
          <button class="action-btn primary" data-action="run-all">
            <ha-icon icon="mdi:play-circle-outline"></ha-icon> Run all
          </button>
          <button class="action-btn" data-action="pause-all">
            <ha-icon icon="mdi:stop-circle-outline"></ha-icon> Stop all
          </button>
          ${hasRainEntity ? `
            <button class="action-btn ${hasRainDelay ? 'rain-active' : ''}" data-action="toggle-rain">
              <ha-icon icon="mdi:weather-rainy"></ha-icon>
              ${hasRainDelay ? 'Cancel delay' : 'Rain delay'}
            </button>` : ''}
        </div>
      `;
    }

    // ── Events ────────────────────────────────────────────────────
    _bindEvents() {
      const root = this.shadowRoot;

      // Zone run/stop — .zc-run-btn (new wireframe layout)
      root.querySelectorAll('.zc-run-btn').forEach(btn => {
        btn.addEventListener('click', e => {
          e.stopPropagation();
          const { entity, action, runTime } = btn.dataset;
          if (action === 'run') {
            this._runZone(entity, parseInt(runTime) || 10);
          } else {
            this._stopZone(entity);
          }
        });
      });

      // Smart watering entity toggle
      root.querySelectorAll('.zc-sw-toggle').forEach(btn => {
        btn.addEventListener('click', e => {
          e.stopPropagation();
          const entity = btn.dataset.swEntity;
          const isOn   = btn.dataset.swOn === 'true';
          if (entity) {
            this._svc('homeassistant', isOn ? 'turn_off' : 'turn_on', { entity_id: entity });
            btn.classList.toggle('on',  !isOn);
            btn.classList.toggle('off',  isOn);
            btn.dataset.swOn = String(!isOn);
            const knob = btn.querySelector('.zc-sw-toggle-knob');
            if (knob) knob.style.left = (!isOn ? '21px' : '3px');
          }
        });
      });

      // Program on/off toggles
      root.querySelectorAll('.zc-prog-toggle').forEach(btn => {
        btn.addEventListener('click', e => {
          e.stopPropagation();
          const entity = btn.dataset.progEntity;
          const isOn   = btn.dataset.progOn === 'true';
          if (entity) {
            this._svc('homeassistant', isOn ? 'turn_off' : 'turn_on', { entity_id: entity });
            // Optimistic visual toggle while HA confirms
            btn.classList.toggle('on',  !isOn);
            btn.classList.toggle('off',  isOn);
            btn.dataset.progOn = String(!isOn);
            const knob = btn.querySelector('.zc-prog-toggle-knob');
            if (knob) knob.style.left = (!isOn ? '21px' : '3px');
          }
        });
      });

      // Action buttons
      root.querySelectorAll('.action-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          const action = btn.dataset.action;
          const zones  = this._config.zones || [];
          if (action === 'run-all') {
            zones.forEach(z => this._runZone(z.entity, z.run_time || 10));
          } else if (action === 'pause-all') {
            zones.forEach(z => this._stopZone(z.entity));
          } else if (action === 'toggle-rain') {
            const rde = this._config.rain_delay_entity ||
              this._config.zones?.map(z=>z.rain_delay_entity).find(Boolean)||'';
            if (!rde) return;
            const isActive = this._isOn(rde);
            if (this._hass?.services?.bhyve?.disable_rain_delay && isActive) {
              this._svc('bhyve', 'disable_rain_delay', { entity_id: rde });
            } else if (this._hass?.services?.bhyve?.enable_rain_delay && !isActive) {
              this._svc('bhyve', 'enable_rain_delay',  { entity_id: rde, hours: 24 });
            } else {
              this._svc('homeassistant', 'toggle', { entity_id: rde });
            }
          }
        });
      });
    }
  }

  // ---------------------------------------------------------------------------
  // Visual Config Editor
  // ---------------------------------------------------------------------------
  class BhyveSprinklerCardEditor extends HTMLElement {
    constructor() {
      super();
      this.attachShadow({ mode: 'open' });
      this._config  = {};
      this._hass    = null;
      this._dragIdx = null;
      // Stop keyboard events (e, c, arrow keys etc.) from reaching HA Lovelace shortcuts
      this.addEventListener('keydown', e => e.stopPropagation());
      this.addEventListener('keyup',   e => e.stopPropagation());
    }

    setConfig(config) {
      this._config = { ...(config || {}) };
      this._render();
    }

    set hass(hass) {
      this._hass = hass;
      // Re-push hass + values to all pickers whenever hass updates
      this._initPickers();
    }

    // ── Config helpers ─────────────────────────────────────────────
    _fire(cfg) {
      this.dispatchEvent(new CustomEvent('config-changed', {
        detail: { config: cfg }, bubbles: true, composed: true,
      }));
    }
    _patch(key, value) {
      const next = { ...this._config, [key]: value };
      this._config = next;
      this._fire(next);
    }
    _patchZone(idx, key, value) {
      const zones = [...(this._config.zones || [])];
      zones[idx] = { ...zones[idx], [key]: value };
      this._patch('zones', zones);
    }
    _addZone() {
      const cur = this._config.zones || [];
      this._patch('zones', [...cur, { entity: '', name: `Zone ${cur.length + 1}`, icon: 'mdi:sprinkler', run_time: 10 }]);
      this._render();
    }
    _removeZone(idx) {
      const zones = [...(this._config.zones || [])];
      zones.splice(idx, 1);
      this._patch('zones', zones);
      this._render();
    }
    _moveZone(idx, dir) {
      const zones = [...(this._config.zones || [])];
      const t = idx + dir;
      if (t < 0 || t >= zones.length) return;
      [zones[idx], zones[t]] = [zones[t], zones[idx]];
      this._patch('zones', zones);
      this._render();
    }
    _swapZones(fromIdx, toIdx) {
      if (fromIdx === toIdx) return;
      const zones = [...(this._config.zones || [])];
      const [moved] = zones.splice(fromIdx, 1);
      zones.splice(toIdx, 0, moved);
      this._patch('zones', zones);
      this._render();
    }



    // ── Render ─────────────────────────────────────────────────────
    _render() {
      const c     = this._config;
      const zones = c.zones || [];

      // Zone rows — no .value in HTML; values set via _initPickers() after render
      const zoneRows = zones.map((z, i) => `
        <div class="zone-row" draggable="true" data-zone-idx="${i}">
          <div class="zone-drag-handle" title="Drag to reorder">
            <ha-icon icon="mdi:drag-vertical" style="--mdc-icon-size:22px"></ha-icon>
          </div>
          <div class="zone-fields">
            <ha-selector class="zone-sel" data-idx="${i}"></ha-selector>
            <div class="zone-inline">
              <input class="ha-input zone-name" type="text" data-idx="${i}"
                placeholder="Zone name" value="${_escHtml(z.name || '')}">
              <span style="font-size:12px;color:var(--secondary-text-color);white-space:nowrap">Run:</span>
              <input class="ha-input zone-time" type="number" data-idx="${i}"
                min="1" max="120" style="width:58px" value="${z.run_time || 10}">
              <span style="font-size:12px;color:var(--secondary-text-color)">min</span>
            </div>
            <div class="field-row" style="margin-top:4px">
              <span class="field-label">Wi-Fi hub entity <span class="field-optional">(optional)</span></span>
              <ha-selector class="zone-hub-sel" data-idx="${i}"></ha-selector>
            </div>
            <div class="field-row" style="margin-top:4px">
              <span class="field-label">Battery sensor <span class="field-optional">(optional)</span></span>
              <ha-selector class="zone-bat-sel" data-idx="${i}"></ha-selector>
            </div>
            <div class="field-row" style="margin-top:4px">
              <span class="field-label">Program entities <span class="field-optional">(optional — enables toggles)</span></span>
              ${(z.program_entities || []).map((pe, pi) => `
                <div style="display:flex;gap:4px;margin-bottom:4px;align-items:center">
                  <ha-selector class="zone-prog-sel" data-idx="${i}" data-prog-idx="${pi}" style="flex:1"></ha-selector>
                  <button class="icon-btn danger remove-prog" data-idx="${i}" data-prog-idx="${pi}" title="Remove">
                    <ha-icon icon="mdi:close" style="--mdc-icon-size:14px"></ha-icon>
                  </button>
                </div>`).join('')}
              <button class="icon-btn add-prog-btn" data-idx="${i}" style="width:100%;margin-top:2px">
                <ha-icon icon="mdi:plus" style="--mdc-icon-size:14px"></ha-icon> Add program
              </button>
            </div>
            <div class="field-row" style="margin-top:8px;padding-top:8px;border-top:1px solid var(--divider-color)">
              <span class="field-label" style="font-size:10px;font-weight:700;letter-spacing:.07em;text-transform:uppercase;color:var(--secondary-text-color)">Settings</span>
              <div style="margin-top:4px">
                <span class="field-label" style="font-size:11.5px">Smart watering entity <span class="field-optional">(optional)</span></span>
                <ha-selector class="zone-sw-sel" data-idx="${i}" style="margin-top:3px"></ha-selector>
              </div>
            </div>
            <div class="field-row" style="margin-top:8px;padding-top:8px;border-top:1px solid var(--divider-color)">
              <span class="field-label" style="font-size:10px;font-weight:700;letter-spacing:.07em;text-transform:uppercase;color:var(--secondary-text-color)">Schedule <span style="text-transform:none;font-weight:400;opacity:.7">(fallback)</span></span>
              <div class="day-picker" style="margin-top:5px">
                ${['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map((d,dIdx) =>
                  `<button class="day-btn zone-day-btn${(z.schedule_days||[]).includes(dIdx)?' active':''}" data-idx="${i}" data-day="${dIdx}">${d}</button>`
                ).join('')}
              </div>
              <div style="margin-top:6px"><ha-selector class="zone-time-sel" data-idx="${i}"></ha-selector></div>
            </div>
            <div class="field-row" style="margin-top:8px;padding-top:8px;border-top:1px solid var(--divider-color)">
              <span class="field-label" style="font-size:10px;font-weight:700;letter-spacing:.07em;text-transform:uppercase;color:var(--secondary-text-color)">Display</span>
              <div class="toggle-row" style="margin-top:5px"><span class="toggle-label" style="font-size:12px">Show sprinkler type</span><label class="toggle-switch"><input type="checkbox" class="zone-toggle" data-idx="${i}" data-zone-key="show_sprinkler_type" ${(z.show_sprinkler_type ?? true) ? 'checked' : ''}><span class="toggle-slider"></span></label></div>
              <div class="toggle-row"><span class="toggle-label" style="font-size:12px">Show programs</span><label class="toggle-switch"><input type="checkbox" class="zone-toggle" data-idx="${i}" data-zone-key="show_programs" ${(z.show_programs ?? true) ? 'checked' : ''}><span class="toggle-slider"></span></label></div>
            </div>
            <div class="field-row" style="margin-top:8px;padding-top:8px;border-top:1px solid var(--divider-color)">
              <span class="field-label" style="font-size:10px;font-weight:700;letter-spacing:.07em;text-transform:uppercase;color:var(--secondary-text-color)">Rain delay</span>
              <div style="margin-top:5px"><ha-selector class="zone-rain-sel" data-idx="${i}"></ha-selector></div>
            </div>
          </div>
          <div class="zone-actions">
            <button class="icon-btn danger remove-zone" data-idx="${i}" title="Remove zone">
              <ha-icon icon="mdi:delete-outline" style="--mdc-icon-size:18px"></ha-icon>
            </button>
          </div>
        </div>`).join('');

      // Render skeleton — entity pickers have NO .value attribute here;
      // values are set as DOM properties in _initPickers() below.
      this.shadowRoot.innerHTML = `
        <style>${EDITOR_STYLES}</style>

        <!-- ── Card settings ── -->
        <div class="editor-section">
          <div class="editor-section-title">Card settings</div>
          <div class="field-row">
            <span class="field-label">Card title</span>
            <input class="ha-input" id="title" type="text"
              placeholder="BHyve Sprinkler" value="${_escHtml(c.title || '')}">
          </div>
          <div class="field-row">
            <span class="field-label">Subtitle / controller name</span>
            <input class="ha-input" id="controller_name" type="text"
              placeholder="Smart Controller" value="${_escHtml(c.controller_name || '')}">
          </div>
          <div class="field-row">
            <span class="field-label">Zone columns</span>
            <select class="ha-input" id="columns">
              <option value="1" ${(c.columns||2)==1?'selected':''}>1 column</option>
              <option value="2" ${(c.columns||2)==2?'selected':''}>2 columns</option>
            </select>
          </div>
        </div>

        <!-- ── Zones ── -->
        <div class="editor-section">
          <div class="editor-section-title">Zones (${zones.length})</div>

          <div id="zone-list">${zoneRows}</div>
          <button class="add-zone-btn" id="add-zone">
            <ha-icon icon="mdi:plus" style="--mdc-icon-size:16px"></ha-icon>
            Add zone
          </button>
        </div>

        <!-- ── Wi-Fi Hub ── -->
        <div class="editor-section">
          <div class="editor-section-title">Wi-Fi hub</div>
          <div class="field-row">
            <span class="field-label">Hub entity <span class="field-optional">(optional)</span></span>
            <ha-selector id="hub-sel"></ha-selector>
            <span class="field-hint">Binary sensor or device reporting hub online / offline status</span>
          </div>
          <div class="toggle-row">
            <span class="toggle-label">Show Wi-Fi hub section</span>
            <label class="toggle-switch">
              <input type="checkbox" data-key="show_hub" ${c.show_hub !== false ? 'checked' : ''}>
              <span class="toggle-slider"></span>
            </label>
          </div>
        </div>

        <!-- ── Rain delay entity (card-level fallback) ── -->
        <div class="editor-section">
          <div class="editor-section-title">Rain delay <span style="font-size:11px;font-weight:400;opacity:.6">(card-level fallback)</span></div>
          <div class="field-row">
            <span class="field-label">Default rain delay entity</span>
            <ha-selector id="rain-delay-sel"></ha-selector>
            <span class="field-hint">Used for zones without a per-zone rain delay entity set</span>
          </div>
        </div>

        <!-- ── Device health entities ── -->
        <div class="editor-section">
          <div class="editor-section-title">Device health</div>
          <div class="field-row">
            <span class="field-label">Battery level sensor <span class="field-optional">(optional)</span></span>
            <ha-selector id="battery-sel"></ha-selector>
            <span class="field-hint">Sensor reporting battery % — shows colour-coded chip</span>
          </div>

          <div class="toggle-row">
            <span class="toggle-label">Show battery chip</span>
            <label class="toggle-switch">
              <input type="checkbox" data-key="show_health_battery" ${c.show_health_battery !== false ? 'checked' : ''}>
              <span class="toggle-slider"></span>
            </label>
          </div>
          <div class="toggle-row">
            <span class="toggle-label">Show last-seen chip</span>
            <label class="toggle-switch">
              <input type="checkbox" data-key="show_health_last_seen" ${c.show_health_last_seen !== false ? 'checked' : ''}>
              <span class="toggle-slider"></span>
            </label>
          </div>
          <div class="toggle-row">
            <span class="toggle-label">Show zone count chip</span>
            <label class="toggle-switch">
              <input type="checkbox" data-key="show_health_zones" ${c.show_health_zones !== false ? 'checked' : ''}>
              <span class="toggle-slider"></span>
            </label>
          </div>
          <div class="toggle-row">
            <span class="toggle-label">Show device health section</span>
            <label class="toggle-switch">
              <input type="checkbox" data-key="show_health" ${c.show_health !== false ? 'checked' : ''}>
              <span class="toggle-slider"></span>
            </label>
          </div>
        </div>

        <!-- ── Action buttons ── -->
        <div class="editor-section">
          <div class="editor-section-title">Action buttons</div>
          <div class="toggle-row">
            <span class="toggle-label">Show action buttons (Run all, Pause, Rain delay)</span>
            <label class="toggle-switch">
              <input type="checkbox" data-key="show_actions" ${c.show_actions !== false ? 'checked' : ''}>
              <span class="toggle-slider"></span>
            </label>
          </div>
        </div>
      `;

      this._bindEditorEvents();
      // IMPORTANT: set hass + value as DOM properties AFTER innerHTML —
      // HTML attributes (.value="...") are ignored by HA custom elements.
      this._initPickers();
    }

    // Initialise every ha-selector as a DOM property call —
    // ha-selector ignores HTML attributes; hass/selector/value/label
    // must all be set as JS properties after innerHTML is written.
    _initPickers() {
      const root = this.shadowRoot;
      const h    = this._hass;
      const c    = this._config;
      if (!h) return;

      const init = (el, selectorDef, value, label) => {
        if (!el) return;
        el.hass     = h;
        el.selector = selectorDef;
        el.value    = value || '';
        el.label    = label || '';
      };

      // Main entity selectors — selector restricts to sensible domains
      init(root.getElementById('rain-delay-sel'),
        { entity: { domain: ['binary_sensor', 'switch'] } },
        c.rain_delay_entity, 'Rain delay entity');


      init(root.getElementById('battery-sel'),
        { entity: { domain: 'sensor', device_class: 'battery' } },
        c.battery_entity, 'Battery level sensor');

      init(root.getElementById('hub-sel'),
        { entity: {} },
        c.hub_entity, 'Hub entity');

      // Zone entity selectors
      root.querySelectorAll('.zone-sel').forEach(sel => {
        const idx = parseInt(sel.dataset.idx);
        init(sel, { entity: { domain: ['switch', 'valve'] } },
          c.zones?.[idx]?.entity || '', `Zone ${idx + 1} entity`);
      });
      // Zone Wi-Fi hub selectors
      root.querySelectorAll('.zone-hub-sel').forEach(sel => {
        const idx = parseInt(sel.dataset.idx);
        init(sel, { entity: {} },
          c.zones?.[idx]?.hub_entity || '', 'Wi-Fi hub entity');
      });
      // Zone battery selectors
      root.querySelectorAll('.zone-bat-sel').forEach(sel => {
        const idx = parseInt(sel.dataset.idx);
        init(sel, { entity: { domain: 'sensor', device_class: 'battery' } },
          c.zones?.[idx]?.battery_entity || '', 'Battery sensor');
      });
      // Zone program entity selectors
      root.querySelectorAll('.zone-prog-sel').forEach(sel => {
        const idx  = parseInt(sel.dataset.idx);
        const pidx = parseInt(sel.dataset.progIdx);
        init(sel, { entity: { domain: 'switch' } },
          c.zones?.[idx]?.program_entities?.[pidx] || '', 'Program switch entity');
      });
      root.querySelectorAll('.zone-time-sel').forEach(sel => {
        const idx = parseInt(sel.dataset.idx);
        sel.hass = h; sel.selector = { time: {} };
        sel.value = c.zones?.[idx]?.schedule_time || '';
        sel.label = 'Start time (fallback)';
      });
      root.querySelectorAll('.zone-rain-sel').forEach(sel => {
        const idx = parseInt(sel.dataset.idx);
        init(sel, { entity: {} },
          c.zones?.[idx]?.rain_delay_entity || '', 'Rain delay entity');
      });
      root.querySelectorAll('.zone-sw-sel').forEach(sel => {
        const idx = parseInt(sel.dataset.idx);
        init(sel, { entity: { domain: 'switch' } },
          c.zones?.[idx]?.smart_watering_entity || '', 'Smart watering entity');
      });
    }

    // ── Event binding ──────────────────────────────────────────────
    _bindEditorEvents() {
      const root = this.shadowRoot;

      // Text / select inputs
      ['title','controller_name'].forEach(id => {
        const el = root.getElementById(id);
        if (!el) return;
        el.addEventListener('change', () => this._patch(id, el.value));
        el.addEventListener('input',  () => this._patch(id, el.value));
      });
      const cols = root.getElementById('columns');
      if (cols) cols.addEventListener('change', () => this._patch('columns', parseInt(cols.value)));

      // Boolean toggles
      root.querySelectorAll('input[type="checkbox"][data-key]').forEach(cb =>
        cb.addEventListener('change', () => this._patch(cb.dataset.key, cb.checked)));

      // Main entity selectors (ha-selector fires value-changed with e.detail.value)
      const selMap = {
        'rain-delay-sel': 'rain_delay_entity',
        'battery-sel':    'battery_entity',
        'hub-sel':        'hub_entity',
      };
      Object.entries(selMap).forEach(([id, key]) => {
        const el = root.getElementById(id);
        if (el) el.addEventListener('value-changed', e => this._patch(key, e.detail?.value ?? ''));
      });

      // Zone Wi-Fi hub selectors
      root.querySelectorAll('.zone-hub-sel').forEach(sel =>
        sel.addEventListener('value-changed', e =>
          this._patchZone(parseInt(sel.dataset.idx), 'hub_entity', e.detail?.value ?? '')));
      // Zone battery selectors
      root.querySelectorAll('.zone-bat-sel').forEach(sel =>
        sel.addEventListener('value-changed', e =>
          this._patchZone(parseInt(sel.dataset.idx), 'battery_entity', e.detail?.value ?? '')));
      // Zone program entity selectors
      root.querySelectorAll('.zone-prog-sel').forEach(sel =>
        sel.addEventListener('value-changed', e => {
          const idx   = parseInt(sel.dataset.idx);
          const pidx  = parseInt(sel.dataset.progIdx);
          const progs = [...(this._config.zones?.[idx]?.program_entities || [])];
          progs[pidx] = e.detail?.value ?? '';
          this._patchZone(idx, 'program_entities', progs.filter(Boolean));
        }));
      // Add program button
      root.querySelectorAll('.add-prog-btn').forEach(btn =>
        btn.addEventListener('click', () => {
          const idx   = parseInt(btn.dataset.idx);
          const progs = [...(this._config.zones?.[idx]?.program_entities || []), ''];
          this._patchZone(idx, 'program_entities', progs);
          this._render();
        }));
      // Remove program button
      root.querySelectorAll('.remove-prog').forEach(btn =>
        btn.addEventListener('click', () => {
          const idx   = parseInt(btn.dataset.idx);
          const pidx  = parseInt(btn.dataset.progIdx);
          const progs = [...(this._config.zones?.[idx]?.program_entities || [])];
          progs.splice(pidx, 1);
          this._patchZone(idx, 'program_entities', progs);
          this._render();
        }));
      // Zone entity selectors — also auto-fill name from friendly_name if blank
      root.querySelectorAll('.zone-sel').forEach(sel =>
        sel.addEventListener('value-changed', e => {
          const idx    = parseInt(sel.dataset.idx);
          const entity = e.detail?.value ?? '';
          this._patchZone(idx, 'entity', entity);
          // Auto-fill zone name from the entity's friendly_name when name is empty
          const currentName = this._config.zones?.[idx]?.name || '';
          if (!currentName || currentName.startsWith('Zone ')) {
            const fname = this._hass?.states?.[entity]?.attributes?.friendly_name;
            if (fname) this._patchZone(idx, 'name', fname);
          }
        }));

      // Zone name / time inputs
      root.querySelectorAll('.zone-name').forEach(inp =>
        inp.addEventListener('change', () =>
          this._patchZone(parseInt(inp.dataset.idx), 'name', inp.value)));
      root.querySelectorAll('.zone-time').forEach(inp =>
        inp.addEventListener('change', () =>
          this._patchZone(parseInt(inp.dataset.idx), 'run_time', parseInt(inp.value) || 10)));

      // Remove buttons
      root.querySelectorAll('.remove-zone').forEach(b =>
        b.addEventListener('click', () => this._removeZone(parseInt(b.dataset.idx))));

      // Add zone
      const addBtn = root.getElementById('add-zone');
      if (addBtn) addBtn.addEventListener('click', () => this._addZone());

      // Per-zone schedule day buttons
      root.querySelectorAll('.zone-day-btn').forEach(btn =>
        btn.addEventListener('click', () => {
          const zIdx = parseInt(btn.dataset.idx);
          const day  = parseInt(btn.dataset.day);
          const days = [...(this._config.zones?.[zIdx]?.schedule_days || [])];
          const pos  = days.indexOf(day);
          if (pos >= 0) days.splice(pos, 1); else days.push(day);
          days.sort((a, b) => a - b);
          this._patchZone(zIdx, 'schedule_days', days);
          btn.classList.toggle('active', days.includes(day));
        }));
      root.querySelectorAll('.zone-time-sel').forEach(sel =>
        sel.addEventListener('value-changed', e =>
          this._patchZone(parseInt(sel.dataset.idx), 'schedule_time', e.detail?.value ?? '')));
      root.querySelectorAll('.zone-rain-sel').forEach(sel =>
        sel.addEventListener('value-changed', e =>
          this._patchZone(parseInt(sel.dataset.idx), 'rain_delay_entity', e.detail?.value ?? '')));
      root.querySelectorAll('.zone-sw-sel').forEach(sel =>
        sel.addEventListener('value-changed', e =>
          this._patchZone(parseInt(sel.dataset.idx), 'smart_watering_entity', e.detail?.value ?? '')));
      root.querySelectorAll('.zone-toggle').forEach(chk =>
        chk.addEventListener('change', () =>
          this._patchZone(parseInt(chk.dataset.idx), chk.dataset.zoneKey, chk.checked)));

      // Drag & drop
      this._bindDragDrop();
    }

    _bindDragDrop() {
      const root = this.shadowRoot;
      const rows = root.querySelectorAll('.zone-row[draggable]');

      rows.forEach(row => {
        row.addEventListener('dragstart', e => {
          this._dragIdx = parseInt(row.dataset.zoneIdx);
          e.dataTransfer.effectAllowed = 'move';
          requestAnimationFrame(() => row.classList.add('dragging'));
        });

        row.addEventListener('dragend', () => {
          this._dragIdx = null;
          rows.forEach(r => r.classList.remove('dragging', 'drag-over'));
        });

        row.addEventListener('dragover', e => {
          e.preventDefault();
          e.dataTransfer.dropEffect = 'move';
          const overIdx = parseInt(row.dataset.zoneIdx);
          if (this._dragIdx !== null && this._dragIdx !== overIdx) {
            rows.forEach(r => r.classList.remove('drag-over'));
            row.classList.add('drag-over');
          }
        });

        row.addEventListener('dragleave', e => {
          if (!row.contains(e.relatedTarget)) row.classList.remove('drag-over');
        });

        row.addEventListener('drop', e => {
          e.preventDefault();
          const toIdx = parseInt(row.dataset.zoneIdx);
          if (this._dragIdx !== null && this._dragIdx !== toIdx) {
            this._swapZones(this._dragIdx, toIdx);
          }
        });
      });
    }
  }

  // ---------------------------------------------------------------------------
  // Register
  // ---------------------------------------------------------------------------
  if (!customElements.get(CARD_TYPE)) {
    customElements.define(CARD_TYPE, BhyveSprinklerCard);
  }
  if (!customElements.get(EDITOR_TYPE)) {
    customElements.define(EDITOR_TYPE, BhyveSprinklerCardEditor);
  }

  window.customCards = window.customCards || [];
  if (!window.customCards.find(c => c.type === CARD_TYPE)) {
    window.customCards.push({
      type:             CARD_TYPE,
      name:             'BHyve Sprinkler Card',
      description:      'Feature-rich Lovelace card for Orbit BHyve smart sprinkler systems.',
      preview:          true,
      documentationURL: 'https://github.com/reypm/Orbit-BHyve-Custom-Card',
    });
  }

  console.info(
    '%c BHYVE-SPRINKLER-CARD %c v' + CARD_VERSION + ' ',
    'color:#fff;background:#1D9E75;font-weight:700;padding:2px 5px;border-radius:3px 0 0 3px',
    'color:#1D9E75;background:#fff;font-weight:700;padding:2px 5px;border-radius:0 3px 3px 0;border:1px solid #1D9E75'
  );
})();
