/**
 * Optional live hardware checks. Run: npm run test:hw
 * Skips individual checks when MIDI / Flex are not reachable (does not fail the suite for absence).
 * Safe: lists MIDI, opens port briefly if free; TCP connect to Flex only (no TX commands).
 */
const { describe, it, before } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const net = require("net");

const root = path.join(__dirname, "..");

function loadJson(rel)
{
    return JSON.parse(fs.readFileSync(path.join(root, rel), "utf8"));
}

function midiNameMatch(deviceName, wanted)
{
    if(!wanted)
        return false;
    const a = String(deviceName).toLowerCase();
    const b = String(wanted).toLowerCase();
    return a === b || a.includes(b) || b.includes(a);
}

function tcpReachable(host, port, timeoutMs)
{
    return new Promise((resolve) =>
    {
        const socket = net.connect({ host, port });
        let done = false;
        const finish = (ok, err) =>
        {
            if(done)
                return;
            done = true;
            try { socket.destroy(); } catch(e) {}
            resolve({ ok, err: err ? String(err.message || err) : null });
        };
        socket.setTimeout(timeoutMs);
        socket.on("connect", () => finish(true, null));
        socket.on("timeout", () => finish(false, new Error("timeout")));
        socket.on("error", (err) => finish(false, err));
    });
}

describe("hardware (live)", () =>
{
    let globalCfg;
    let config;
    let midiWanted;
    let inputs = [];
    let outputs = [];
    let midiListed = false;
    let easymidi = null;
    let flexHost;
    let flexPort;

    before(() =>
    {
        globalCfg = loadJson(path.join("public", "global.json"));
        const n = globalCfg.default || 1;
        config = loadJson(path.join("public", "config" + n + ".json"));
        midiWanted = config.WindowsMidiName || "DJControl Starlight";
        flexHost = config.FlexIP;
        flexPort = Number(config.FlexPort) || 4992;

        try
        {
            easymidi = require("easymidi");
            inputs = easymidi.getInputs() || [];
            outputs = easymidi.getOutputs() || [];
            midiListed = inputs.some((n) => midiNameMatch(n, midiWanted))
                || outputs.some((n) => midiNameMatch(n, midiWanted));
        }
        catch(err)
        {
            easymidi = null;
            midiListed = false;
        }
    });

    it("lists configured MIDI device name", (t) =>
    {
        if(!easymidi)
        {
            t.skip("easymidi not loadable");
            return;
        }
        if(!midiListed)
        {
            t.skip("MIDI device not found: wanted \"" + midiWanted + "\"; inputs=" + JSON.stringify(inputs));
            return;
        }
        assert.ok(midiListed);
    });

    it("can open MIDI input briefly (or skip if busy)", (t) =>
    {
        if(!easymidi || !midiListed)
        {
            t.skip("MIDI device not available");
            return;
        }
        const name = inputs.find((n) => midiNameMatch(n, midiWanted))
            || outputs.find((n) => midiNameMatch(n, midiWanted));
        let input;
        try
        {
            input = new easymidi.Input(name);
            assert.ok(input);
        }
        catch(err)
        {
            // Often fails if Hercules already holds the port — still proves device exists via list test
            t.skip("MIDI open failed (device may be in use by Hercules): " + (err.message || err));
            return;
        }
        finally
        {
            try { if(input) input.close(); } catch(e) {}
        }
    });

    it("Flex TCP port is reachable", async (t) =>
    {
        if(!flexHost)
        {
            t.skip("FlexIP missing in config");
            return;
        }
        const result = await tcpReachable(flexHost, flexPort, 3000);
        if(!result.ok)
        {
            t.skip("Flex not reachable at " + flexHost + ":" + flexPort + " (" + result.err + ")");
            return;
        }
        assert.equal(result.ok, true);
    });
});
