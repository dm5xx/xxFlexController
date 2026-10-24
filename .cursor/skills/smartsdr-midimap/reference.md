# Extra reference

## Emitter events (app / radio side)

| Event | Typical source | Role |
|-------|----------------|------|
| `ce` | controller `handleHardware` | Control element → dominator |
| `cptt` | `xmit` | PTT path MultiFlex |
| `ct` | `panBW` / `center` | Center/tune follow-up |
| `fadeSO2R` / `fadeSO2RMix` | crossfader helpers | SO2R audio |
| `def` | `setdefault` | Reset defaults |
| `con` | `configMode` | Enter config / radio select |
| `tgl` | `toggleLayer` | Layer switch |
| `connected` | radio | Link up |

## Slice indexing

- UI Part `A` → logical slice 0, Part `B` → 1
- `getRealSlice` maps to SmartSDR slice index via radio state (`SliceNumbs` / active mapping)

## Value scaling

- MIDI often 0–127; gain uses `#hundret27to100Converter` (~0–100)
- Jog/RIT/XIT use `#Spreader(state, factor, middle=64)`
- `RitFreq` in defaults: factors for phone vs CW style offsets

## Docs to scrape when unsure

1. **https://github.com/flexradio** — official APIs/SDKs
2. [smartsdr-api-docs](https://github.com/flexradio/smartsdr-api-docs) + [TCPIP API wiki](https://github.com/flexradio/smartsdr-api-docs/wiki/SmartSDR-TCPIP-API)
3. **https://github.com/stephenhouser/node-red-contrib-flexradio** — JS examples, `PROTOCOL.md` (reference only; **no Node-RED** here)
4. **https://github.com/aethersdr/AetherSDR** + [Multi-Flex](https://docs.aethersdr.com/multi-flex) — GUI peer alongside SmartSDR
5. **https://github.com/aethersdr/Aether-gate** — bridge non-Flex radios into AetherSDR; inspiration for future extensions (do not vendor by default)
6. Installed client here: `flexradio-js` (`Radio`, `send`, status) — used by `xxflexradio.js`
7. MIDI only: `easymidi` — not FlexRadio
