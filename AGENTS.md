# Agent notes — xxFlexController

## What this is

Standalone Node app that maps a **Hercules DJ Control Starlight** MIDI controller to a **FlexRadio** via the SmartSDR TCP API. **No Node-RED** (and no Raspberry required). `xxflexradio.js` is inspired by the Stephen Houser Flex JS stack.

GUI peer for MultiFlex can be **SmartSDR or AetherSDR** (same radio TCP; Hercules only does `client bind`).

## Run locally

Requires **Node.js ≥ 18** (tested with current Node on Windows; system install under `C:\Program Files\nodejs`).

```bash
npm install
npm start
# or: node app.js

# Browser UI (Terminal + Configs): public/global.json → "JsonEditor": true (default)
# "RunInBackground": true (default) → re-spawn hidden (brief console flash OK); tab close exits (~15s)
# "RunInBackground": false → visible console; tab close does NOT exit
# UI only: npm run editor  |  node app.js --editor  |  xxHercules.exe --editor
# → http://127.0.0.1:<JsonEditorPort>/  (default 5555) Terminal + Configs tabs

# Windows EXE for distribution (pkg):
npm run build:exe
# → dist/xxHercules.exe + dist/public/  (run from dist/)
# Config UI: xxHercules.exe --editor  (from dist/)
```

MIDI uses `@julusian/midi` (via `easymidi`); allow its install scripts if npm prompts (`npm install-scripts approve @julusian/midi`).

Logging: `logger.js` — **info/warn/error** always; **debug** only if `Debug: true` in `public/global.json` (MIDI raw, unmapped keys, init chatter).

A GUI client (SmartSDR or AetherSDR) should be running; set Flex IP in `public/configN.json` (or use the config editor).

## MultiFlex with SmartSDR or AetherSDR

1. Enable multiFLEX on the radio.
2. Config needs only `FlexIP` (etc.) — **no GUI client IDs required**.
3. Hercules auto-detects SmartSDR/AetherSDR on **this PC** via Flex UDP discovery (`gui_client_ips` / host / station) and binds that client; other network MultiFlex GUIs are ignored.
4. Start local SmartSDR **or** [AetherSDR](https://github.com/aethersdr/AetherSDR); switching locally rebinds automatically.
5. Optional overrides only: `GuiClientID`, `GuiProgram`, `SmartSDRClientID`, `AetherSDRClientID`.
6. Docs: [AetherSDR Multi-Flex](https://docs.aethersdr.com/multi-flex)

## Where to change what

| Goal | Touch |
|------|--------|
| Flex IP / station / GUI client id | `public/config*.json`, `public/global.json` (or `npm run editor`) |
| Default filters / RIT / modes | `public/defaults.json` (or editor) |
| Browser config UI | `configeditor.js` |
| Button → function mapping | Excel midimap (`MidimapFile`, usually `hercules.xlsx`) |
| New radio command | `flexdominator.js` (+ map name in Excel) |
| MIDI / LED behavior | `djcontrollerstarlight.js`, `controller.js` |
| Startup / config mode / layers | `app.js` |
| GUI bind / MultiFlex discovery | `xxflexradio.js` |

## Constraints

- CommonJS only; mirror existing naming and patterns
- GPL-3.0; preserve attribution in user-facing docs
- **FlexRadio APIs/docs:** [github.com/flexradio](https://github.com/flexradio) — [smartsdr-api-docs](https://github.com/flexradio/smartsdr-api-docs) / [TCPIP API wiki](https://github.com/flexradio/smartsdr-api-docs/wiki/SmartSDR-TCPIP-API)
- **JS examples / how Flex is done in JS:** [stephenhouser/node-red-contrib-flexradio](https://github.com/stephenhouser/node-red-contrib-flexradio) — learn from it; **never** pull Node-RED into this repo; port patterns into `xxflexradio.js` / `flexdominator.js`
- **AetherSDR (GUI peer):** [github.com/aethersdr/AetherSDR](https://github.com/aethersdr/AetherSDR) — do not embed; bind only
- **Aether-gate (other radios → AetherSDR):** [github.com/aethersdr/Aether-gate](https://github.com/aethersdr/Aether-gate) — ideas/examples for future extensions; do not vendor unless asked
- User-facing chat: German; code/paths/commits: English as in the repo
- New controllers: extend `controller`, emit `"ce"`, wire in `app.js` + Excel midimap (see `.cursor/rules/new-controller.mdc`)
- Domain skill: `.cursor/skills/smartsdr-midimap/` — MappedTo, Excel columns, SmartSDR command strings (`/smartsdr-midimap`)
