# Release smoke checklist

Run before shipping `rh.zip` / tagging a release.

## Build

- [ ] `npm test` passes (unit/API, no hardware)
- [ ] `npm run test:hw` — MIDI listed + Flex TCP (also runs automatically as `prebuild`)
- [ ] `npm run test:flex` — optional live VFO/mode/filter/volume/RIT/XIT/RXANT/panBW/PTT vs Flex status (manual; needs GUI)
- [ ] `npm run build` succeeds (release: `npm run build:upversion` bumps OverlayText Build yyyymmddxx)
- [ ] `rh.zip` contains `xxHercules.exe` and `public/` (configs, `hercules.xlsx`, assets)
- [ ] Overlay / `public/global.json` shows expected Build id after `build:upversion`

## App start / browser UI

From `dist/` (or project root with `npm start`):

- [ ] Console window stays visible (foreground)
- [ ] Browser opens on `JsonEditorPort` (default 5555)
- [ ] Overlay shows `OverlayText`, dismisses after `OverlayTime` seconds (or click); empty `OverlayText` = no overlay
- [ ] **Terminal** tab shows live log lines (connect / GUI bind messages)
- [ ] **Configs** tab: edit `config1.json` (e.g. Flex IP), **Save**, confirm file on disk; **Reload** restores disk values
- [ ] Edit `global.json` / `defaults.json` fields; Save works
- [ ] Close browser tab → console / Hercules process **keeps running**

## Radio / MIDI (manual)

With Starlight connected and SmartSDR or AetherSDR on this PC:

- [ ] App connects to Flex (`FlexIP` in active config)
- [ ] Local GUI bind / slices sync (MultiFlex if enabled)
- [ ] PTT works
- [ ] VFO / jog changes frequency
- [ ] At least one mapped button/fader (mode, volume, or filter) acts on the radio
- [ ] Config-mode switch between configs (if you use multiple `configN.json`) behaves as expected

## Restart App (browser)

- [ ] **Restart App** relaunches with a visible console; browser comes back

## Sign-off

| Item | Value |
|------|--------|
| Date | |
| Version / commit | |
| Tester | |
| Notes | |
