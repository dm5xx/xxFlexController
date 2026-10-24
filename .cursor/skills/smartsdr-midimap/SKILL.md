---
name: smartsdr-midimap
description: >-
  SmartSDR TCP command patterns, flexDominator MappedTo names, and Hercules
  Excel midimap columns for xxFlexController. Use when adding radio functions,
  editing hercules.xlsx mapping, MappedTo values, slice/PTT/MultiFlex behavior,
  or constructing Flex API command strings. Upstream APIs:
  https://github.com/flexradio ; JS examples (no Node-RED in-app):
  https://github.com/stephenhouser/node-red-contrib-flexradio ;
  GUI peer AetherSDR: https://github.com/aethersdr/AetherSDR
---

# SmartSDR + Midimap

## Upstream

| Role | URL |
|------|-----|
| Official APIs / protocol | https://github.com/flexradio — [smartsdr-api-docs](https://github.com/flexradio/smartsdr-api-docs), [TCPIP wiki](https://github.com/flexradio/smartsdr-api-docs/wiki/SmartSDR-TCPIP-API) |
| JS implementation examples | https://github.com/stephenhouser/node-red-contrib-flexradio (`PROTOCOL.md`, packages, `flexradio-js` usage) |
| Alternate GUI (same TCP / MultiFlex) | https://github.com/aethersdr/AetherSDR — [Multi-Flex docs](https://docs.aethersdr.com/multi-flex) |
| Other radios via AetherSDR (ideas) | https://github.com/aethersdr/Aether-gate — patterns only; do not vendor |

`xxflexradio.js` is **inspired by** that Houser stack. **Do not** add Node-RED or embed AetherSDR; adapt JS ideas into this standalone app. Align `fire()` strings with flexradio docs + existing code.

## Flow

MIDI → `handle` → `handleHardware` → `emit("ce", element)` → `app.js` →
`flexDominator[elm.MappedTo](elm, xxFlex)` → return string → `xxFlex.fire(cmd)`.

Some actions only emit (`cptt`, `tgl`, `con`, `fadeSO2R*`) and do not return a command.

## Excel midimap columns → `deviceElement`

Order matches `controller.js` / constructor args:

| Col | Field | Notes |
|-----|--------|--------|
| 0 | Part | `"A"` / `"B"` → slice side (`getRequestedSlice`) |
| 1 | Name | Label |
| 2 | Type | `Btn`, pot/fader, `Jog`, … |
| 3 | MsgType | easymidi `_type`: `noteon`, `cc`, … |
| 4 | Channel | MIDI channel |
| 5 | Controller | CC number or note |
| 6 | OnValue | LED on velocity |
| 7 | OffValue | LED off |
| 8 | Id | `"channel\|controller"` (or note) |
| 9 | MappedTo | **Must** match a `flexDominator` method name |
| 10 | BtnTyp | `3` = momentary; else toggle on velocity 127 |
| 11 | GrpId | `>0` = exclusive button group |

Sheets: `midimap` → `Elements` (layer 0), `midimap2` → `Elements1` (layer 1).

## Existing `MappedTo` methods

`xmit`, `modes`, `rit`, `xit`, `volume`, `agc`, `vfo`, `steps`, `filters`,
`toggleRXANT`, `toggleTXANT`, `panBW`, `center`, `fadePan`, `fadeSO2R`,
`fadeSO2RMix`, `freeFilter`, `monitor`, `cwxLoopBtnL`, `cwxLoopBtnR`,
`setdefault`, `configMode`, `toggleLayer`, `toggleSlices`

New Excel function → add same-named method on `flexDominator` first.

## Command patterns (return strings)

Port **4992**. Typical forms used here:

- `slice s <n> mode=…` / `step=` / `rit_on=` / `xit_on=` / `rxant=` / `txant=` / `agc_threshold=`
- `slice tune <n> <freq>`
- `filt <n> <lo> <hi>`
- `display panf s <panId> bandwidth=…`
- `audio client <handle> slice <n> gain|pan <v>`
- `transmit s mon=<0|1>`
- `cwx send <text>` (spaces as in `#convertSpace`)
- Startup/subs: `sub client all`, `sub slice all`, `sub pan all`, `sub radio all`, `client bind client_id=…`

Full protocol wiki: https://github.com/flexradio/smartsdr-api-docs/wiki/SmartSDR-TCPIP-API  
Org index: https://github.com/flexradio

## Defaults (`public/defaults.json`)

`CWMakro`, `NotValidModes`, `NotValidSteps`, `CWFilter`, `Filter`, `PanBW`, `RitFreq` — used by dominator helpers; extend carefully.

## MultiFlex / station (SmartSDR or AetherSDR)

- Default: auto-bind **local** SmartSDR/AetherSDR only (same PC — TCP station/program/host; optional `FlexDiscovery` for UDP `gui_client_ips`); ignore remote MultiFlex GUIs
- GUI client ID config keys are optional overrides; normally omit them
- Empty `StationName` → `COMPUTERNAME` (spaces → DEL char)
- Same radio TCP; Hercules does not embed either GUI
- `xmit` emits `cptt` rather than returning a simple xmit string

## Checklist: new control

1. Add/adjust Excel row (`MappedTo` name)
2. Implement `flexDominator.<MappedTo>` if missing
3. Prefer existing converters (`#hundret27to100Converter`, `#Spreader`, `getRealSlice`)
4. Test both layers if the control exists on `midimap2`
