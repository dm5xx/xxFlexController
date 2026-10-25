# Agent notes — xxFlexController

## What this is

Standalone Node app that maps a **Hercules DJ Control Starlight** MIDI controller to a **FlexRadio** via the SmartSDR TCP API. **No Node-RED** (and no Raspberry required). `xxflexradio.js` is inspired by the Stephen Houser Flex JS stack.

GUI peer for MultiFlex can be **SmartSDR or AetherSDR** (same radio TCP; Hercules only does `client bind`).

## Run locally

Requires **Node.js ≥ 18** (tested with current Node on Windows; system install under `C:\Program Files\nodejs`).

```bash
npm install
npm test          # unit/API checks (no MIDI/Flex required)
npm run test:hw   # MIDI list + Flex TCP (runs on prebuild)
npm run test:flex # manual: VFO/mode/filter/volume/RIT/XIT/RXANT/panBW/PTT via Flex status feedback
npm start
# or: node app.js

# Browser UI (Terminal + Configs): public/global.json → "JsonEditor": true (default)
# Console stays visible; closing the browser tab does not exit the app
# OverlayText / OverlayTime in global.json = startup overlay in the browser (empty text = off)
# UI only: npm run editor  |  node app.js --editor  |  xxHercules.exe --editor
# → http://127.0.0.1:<JsonEditorPort>/  (default 5555) Terminal + Configs tabs

# Windows EXE for distribution (pkg):
npm run build              # → dist/ then rh.zip (zip root = xxHercules.exe + public/)
npm run build:upversion    # same + bumps OverlayText "Build yyyymmddxx" (preferred)
# End users unzip rh.zip and run xxHercules.exe next to public/ (no "dist" folder in the zip)
# Docs: public/newmanual.md|pdf  ·  rebuild PDF: npm run docs:manual
# Config UI: xxHercules.exe --editor
# Before release: docs/SMOKE.md (manual) + npm test
```

MIDI uses `@julusian/midi` (via `easymidi`); allow its install scripts if npm prompts (`npm install-scripts approve @julusian/midi`).

Logging: `logger.js` — **info/warn/error** always; **debug** only if `Debug: true` in `public/global.json` (MIDI raw, unmapped keys, init chatter). `flexradio-js` `Radio[…]` / Discovery console spam is filtered unless Debug is on; command send/receive dumps stay suppressed even then.

A GUI client (SmartSDR or AetherSDR) should be running; set Flex IP in `public/configN.json` (or use the config editor).

## MultiFlex with SmartSDR or AetherSDR

1. Enable multiFLEX on the radio.
2. Config needs only `FlexIP` (etc.) — **no GUI client IDs required**.
3. Hercules auto-detects SmartSDR/AetherSDR on **this PC** via TCP client status (station / program / host) and binds that client; other network MultiFlex GUIs are ignored.
4. **UDP discovery (port 4992) is off by default** (`FlexDiscovery` in `configN.json`). Optional MultiFlex IP filter (`gui_client_ips`); on some **Windows 10** PCs sharing UDP 4992 with an already-running GUI closes that app — leave off or start Hercules first.
5. Start local SmartSDR **or** [AetherSDR](https://github.com/aethersdr/AetherSDR); switching locally rebinds automatically.
6. Optional overrides only: `GuiClientID`, `GuiProgram`, `SmartSDRClientID`, `AetherSDRClientID`.
7. Docs: [AetherSDR Multi-Flex](https://docs.aethersdr.com/multi-flex)

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
