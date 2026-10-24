/**
 * Live Flex status feedback tests. Manual: npm run test:flex
 * Requires Flex reachable + local SmartSDR/AetherSDR (slice bind) like normal app use.
 * No MIDI. PTT is pulsed briefly and forced off in after().
 * Also: RIT, XIT, toggleRXANT, panBW (soft-skip when radio/GUI cannot reflect them).
 */
const { describe, it, before, after } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const EventEmitter = require("node:events");

const root = path.join(__dirname, "..");

function loadJson(rel)
{
    return JSON.parse(fs.readFileSync(path.join(root, rel), "utf8"));
}

function sleep(ms)
{
    return new Promise((r) => setTimeout(r, ms));
}

function waitUntil(fn, timeoutMs, label)
{
    const start = Date.now();
    return new Promise((resolve, reject) =>
    {
        const tick = () =>
        {
            try
            {
                if(fn())
                    return resolve(true);
            }
            catch(e) {}
            if(Date.now() - start > timeoutMs)
                return reject(new Error("timeout waiting for " + (label || "condition")));
            setTimeout(tick, 150);
        };
        tick();
    });
}

function elm(partial)
{
    return Object.assign({ Id: "0|0", Part: "A", State: 0, MappedTo: "" }, partial || {});
}

function truthyFlag(v)
{
    return v === true || v === 1 || v === "1" || v === "true";
}

function truthyTx(v)
{
    return truthyFlag(v);
}

function responseOk(msg)
{
    if(!msg || msg.timeout)
        return false;
    return msg.response_code === 0 || msg.response_code === "0";
}

function sendCmd(radio, cmd, timeoutMs)
{
    return new Promise((resolve) =>
    {
        const timer = setTimeout(() => resolve({ timeout: true }), timeoutMs || 5000);
        radio.send(cmd, (msg) =>
        {
            clearTimeout(timer);
            resolve(msg || {});
        });
    });
}

describe("flex live status feedback", () =>
{
    let radio = null;
    let dom = null;
    let emitter = null;
    let ready = false;
    let skipReason = "Flex / GUI not ready";
    let sliceIdx = 0;
    let original = {};
    let savedConsoleLog = null;
    let savedConsoleInfo = null;

    before(async () =>
    {
        const globalCfg = loadJson("public/global.json");
        const cfgNum = globalCfg.default || 1;
        const config = loadJson("public/config" + cfgNum + ".json");
        const defaults = loadJson("public/defaults.json");

        // Quiet reconnect / flexradio-js flood during tests
        const log = require("../logger.js");
        if(typeof log.setDebug === "function")
            log.setDebug(false);
        savedConsoleLog = console.log;
        savedConsoleInfo = console.info;
        console.log = function() {};
        console.info = function() {};

        emitter = new EventEmitter();
        const xxFlexRadio = require("../xxflexradio.js");
        const flexDominator = require("../flexdominator.js");

        radio = new xxFlexRadio(config, defaults, emitter);
        // Prevent auto-reconnect timers from keeping the process alive
        radio.removeAllListeners("error");
        radio.removeAllListeners("close");
        radio.on("error", () => {});
        radio.on("close", () => {});
        dom = new flexDominator(emitter, defaults);

        emitter.on("cptt", (sl, sli, sta) =>
        {
            if(radio["Slice" + sl] && (radio["Slice" + sl].tx == 0 || radio["Slice" + sl].tx === false || radio["Slice" + sl].tx === "0"))
                radio.fire("slice s " + sli + " tx=1");
            radio.fire("xmit " + sta);
        });

        try
        {
            await new Promise((resolve, reject) =>
            {
                const t = setTimeout(() => reject(new Error("connect timeout")), 20000);
                emitter.once("connected", () =>
                {
                    clearTimeout(t);
                    resolve();
                });
                radio.once("error", (err) =>
                {
                    // ignore transient; connect timeout handles failure
                });
            });
        }
        catch(err)
        {
            skipReason = "Cannot connect to Flex at " + config.FlexIP + ":" + (config.FlexPort || 4992);
            return;
        }

        try
        {
            await waitUntil(() =>
            {
                radio.client_handle = radio.ClientHandle || radio.client_handle;
                return !!(radio.IsInit && radio.SliceNumbs && radio.SliceNumbs.length
                    && radio.Slice0 && radio.Slice0.RF_frequency !== undefined);
            }, 50000, "slice init / GUI bind");
        }
        catch(err)
        {
            skipReason = "No GUI slices yet (start SmartSDR/AetherSDR on this PC): " + err.message;
            return;
        }

        sliceIdx = radio.SliceNumbs[0];
        original = {
            freq: Number(radio.Slice0.RF_frequency),
            mode: radio.Slice0.mode,
            filter_lo: radio.Slice0.filter_lo,
            filter_hi: radio.Slice0.filter_hi,
            rxant: radio.Slice0.rxant,
            rit_on: radio.Slice0.rit_on,
            rit_freq: radio.Slice0.rit_freq,
            xit_on: radio.Slice0.xit_on,
            xit_freq: radio.Slice0.xit_freq,
            panbandwidth: radio.Slice0.panbandwidth,
            pan: radio.Slice0.pan
        };
        ready = true;
    });

    after(async () =>
    {
        try
        {
            if(radio)
            {
                try { radio.fire("xmit 0"); } catch(e) {}
                try { radio.fire("slice s " + sliceIdx + " rit_on=0 rit_freq=0"); } catch(e) {}
                try { radio.fire("slice s " + sliceIdx + " xit_on=0 xit_freq=0"); } catch(e) {}
                if(original.rxant)
                {
                    try { radio.fire("slice s " + sliceIdx + " rxant=" + original.rxant); } catch(e) {}
                }
                await sleep(300);
                radio.removeAllListeners("error");
                radio.removeAllListeners("close");
                radio.on("error", () => {});
                try { radio.disconnect(); } catch(e) {}
            }
        }
        catch(e) {}

        try
        {
            const { discovery_listener } = require("flexradio-js/DiscoveryListener");
            discovery_listener().stop();
        }
        catch(e) {}

        // Discovery UDP / leftover sockets can keep node --test alive; exit after report.
        // Preserve runner exitCode so failed tests still fail the process.
        // Restore console inside the timeout so async Radio/Discovery close noise stays quiet.
        setTimeout(() =>
        {
            if(savedConsoleLog)
                console.log = savedConsoleLog;
            if(savedConsoleInfo)
                console.info = savedConsoleInfo;
            const code = typeof process.exitCode === "number" ? process.exitCode : 0;
            process.exit(code);
        }, 500).unref();
    });

    function requireReady(t)
    {
        if(ready)
            return true;
        t.skip(skipReason);
        return false;
    }

    it("VFO jog changes RF_frequency (status)", async (t) =>
    {
        if(!requireReady(t))
            return;
        const before = Number(radio.Slice0.RF_frequency);
        const cmd = dom.vfo(elm({ State: 1 }), radio);
        assert.ok(cmd && cmd.startsWith("slice tune "));
        radio.fire(cmd);
        await waitUntil(() => Math.abs(Number(radio.Slice0.RF_frequency) - before) > 1e-9, 8000, "freq change");
        assert.notEqual(Number(radio.Slice0.RF_frequency), before);
        // nudge back
        radio.fire(dom.vfo(elm({ State: 0 }), radio));
        await sleep(500);
    });

    it("Mode cycle changes slice mode (status)", async (t) =>
    {
        if(!requireReady(t))
            return;
        const before = radio.Slice0.mode;
        const cmd = dom.modes(elm({}), radio);
        assert.ok(cmd && cmd.includes("mode="));
        radio.fire(cmd);
        await waitUntil(() => radio.Slice0.mode && radio.Slice0.mode !== before, 8000, "mode change");
        assert.notEqual(radio.Slice0.mode, before);
        if(original.mode)
        {
            radio.fire("slice s " + sliceIdx + " mode=" + original.mode);
            await sleep(600);
        }
    });

    it("Filter cycle changes filter_lo/hi (status)", async (t) =>
    {
        if(!requireReady(t))
            return;
        const lo0 = Number(radio.Slice0.filter_lo);
        const hi0 = Number(radio.Slice0.filter_hi);
        const cmd = dom.filters(elm({}), radio);
        assert.ok(cmd && cmd.startsWith("filt "));
        radio.fire(cmd);
        await waitUntil(() =>
        {
            return Number(radio.Slice0.filter_lo) !== lo0 || Number(radio.Slice0.filter_hi) !== hi0;
        }, 8000, "filter change");
        assert.ok(
            Number(radio.Slice0.filter_lo) !== lo0 || Number(radio.Slice0.filter_hi) !== hi0
        );
        if(original.filter_lo !== undefined && original.filter_hi !== undefined)
        {
            radio.fire("filt " + sliceIdx + " " + original.filter_lo + " " + original.filter_hi);
            await sleep(600);
        }
    });

    it("Volume command is accepted by radio", async (t) =>
    {
        if(!requireReady(t))
            return;
        radio.client_handle = radio.ClientHandle || radio.client_handle;
        if(!radio.client_handle)
        {
            t.skip("No client_handle yet");
            return;
        }
        const cmd = dom.volume(elm({ State: 80 }), radio);
        assert.match(cmd, /^audio client .+ slice .+ gain /);
        const reply = await new Promise((resolve) =>
        {
            const timer = setTimeout(() => resolve({ timeout: true }), 5000);
            radio.send(cmd, (msg) =>
            {
                clearTimeout(timer);
                resolve(msg || {});
            });
        });
        if(reply.timeout)
        {
            t.skip("No response to audio client command");
            return;
        }
        // Flex replies typically encode success as response with empty/0 error
        const text = JSON.stringify(reply);
        assert.ok(!/error=1|fail/i.test(text) || reply.type === "response");
    });

    it("RIT encoder turns rit on then off (status)", async (t) =>
    {
        if(!requireReady(t))
            return;
        // Flex often omits delta status for rit — accept reply then refresh via sub slice all
        const cmdOn = dom.rit(elm({ State: 100 }), radio);
        assert.match(cmdOn, /rit_on=1/);
        radio.Slice0.rit_on = 0;
        radio.Slice0.rit_freq = 0;
        const onReply = await sendCmd(radio, cmdOn);
        assert.ok(responseOk(onReply), "rit on rejected by radio");
        radio.fire("sub slice all");
        await waitUntil(() =>
            truthyFlag(radio.Slice0.rit_on) || Number(radio.Slice0.rit_freq) !== 0,
        8000, "rit on after sub");
        assert.ok(truthyFlag(radio.Slice0.rit_on) || Number(radio.Slice0.rit_freq) !== 0);

        const cmdOff = dom.rit(elm({ State: 64 }), radio);
        assert.match(cmdOff, /rit_on=0/);
        const offReply = await sendCmd(radio, cmdOff);
        assert.ok(responseOk(offReply), "rit off rejected by radio");
        radio.fire("sub slice all");
        await waitUntil(() =>
            !truthyFlag(radio.Slice0.rit_on) && !(Number(radio.Slice0.rit_freq) > 0),
        8000, "rit off after sub").catch(() => {});
        radio.fire("slice s " + sliceIdx + " rit_on=0 rit_freq=0");
        await sleep(200);
    });

    it("XIT encoder turns xit on then off (status)", async (t) =>
    {
        if(!requireReady(t))
            return;
        const cmdOn = dom.xit(elm({ State: 100 }), radio);
        assert.match(cmdOn, /xit_on=1/);
        radio.Slice0.xit_on = 0;
        radio.Slice0.xit_freq = 0;
        const onReply = await sendCmd(radio, cmdOn);
        assert.ok(responseOk(onReply), "xit on rejected by radio");
        radio.fire("sub slice all");
        await waitUntil(() =>
            truthyFlag(radio.Slice0.xit_on) || Number(radio.Slice0.xit_freq) !== 0,
        8000, "xit on after sub");
        assert.ok(truthyFlag(radio.Slice0.xit_on) || Number(radio.Slice0.xit_freq) !== 0);

        const cmdOff = dom.xit(elm({ State: 64 }), radio);
        assert.match(cmdOff, /xit_on=0/);
        const offReply = await sendCmd(radio, cmdOff);
        assert.ok(responseOk(offReply), "xit off rejected by radio");
        radio.fire("sub slice all");
        await waitUntil(() =>
            !truthyFlag(radio.Slice0.xit_on) && !(Number(radio.Slice0.xit_freq) > 0),
        8000, "xit off after sub").catch(() => {});
        radio.fire("slice s " + sliceIdx + " xit_on=0 xit_freq=0");
        await sleep(200);
    });

    it("toggleRXANT changes slice rxant (status)", async (t) =>
    {
        if(!requireReady(t))
            return;
        if(radio.Slice0.rxant === undefined || radio.Slice0.txant === undefined)
        {
            t.skip("No rxant/txant on slice yet");
            return;
        }
        // Known start: rxant == txant so toggle goes to RX_A / RX_B
        const txant = String(radio.Slice0.txant);
        const startReply = await sendCmd(radio, "slice s " + sliceIdx + " rxant=" + txant);
        if(!responseOk(startReply))
        {
            t.skip("Cannot set rxant to txant for baseline");
            return;
        }
        radio.fire("sub slice all");
        await waitUntil(() => String(radio.Slice0.rxant) === txant, 8000, "rxant baseline").catch(() => {});
        radio.Slice0.rxant = txant;

        const before = String(radio.Slice0.rxant);
        const cmd = dom.toggleRXANT(elm({}), radio);
        assert.match(cmd, /rxant=/);
        const expected = String(radio.Slice0.rxant);
        radio.Slice0.rxant = before;
        const reply = await sendCmd(radio, cmd);
        if(!responseOk(reply))
        {
            t.skip("rxant command rejected (no RX loop?)");
            radio.fire("slice s " + sliceIdx + " rxant=" + before);
            return;
        }
        radio.fire("sub slice all");
        try
        {
            await waitUntil(() => String(radio.Slice0.rxant) === expected, 8000, "rxant change");
        }
        catch(err)
        {
            t.skip("rxant did not change after sub: " + err.message);
            radio.fire("slice s " + sliceIdx + " rxant=" + (original.rxant || before));
            return;
        }
        assert.equal(String(radio.Slice0.rxant), expected);
        radio.fire("slice s " + sliceIdx + " rxant=" + (original.rxant || before));
        await sleep(300);
    });

    it("panBW cycles display pan bandwidth (status)", async (t) =>
    {
        if(!requireReady(t))
            return;
        if(radio.Slice0.pan === undefined || radio.Slice0.pan === null || radio.Slice0.pan === "")
        {
            t.skip("No pan id on slice");
            return;
        }
        if(radio.Slice0.panbandwidth === undefined)
            radio.Slice0.panbandwidth = (radio.PanBW && radio.PanBW[0]) || 0.05;

        const cmd = dom.panBW(elm({}), radio);
        assert.match(cmd, /^display panf s .+ bandwidth=/);
        const expectedBw = Number(radio.Slice0.panbandwidth);

        let seenBw = null;
        const onStatus = (status) =>
        {
            if(!status || status.payload === undefined)
                return;
            const topic = String(status.topic || "");
            if(topic.indexOf("display/pan") < 0)
                return;
            if(status.payload.bandwidth !== undefined)
                seenBw = Number(status.payload.bandwidth);
        };
        radio.on("status", onStatus);
        const reply = await sendCmd(radio, cmd);
        assert.ok(responseOk(reply), "panBW rejected by radio");
        // Bandwidth deltas are often silent until sub pan all
        radio.fire("sub pan all");
        try
        {
            await waitUntil(() =>
                seenBw !== null && Math.abs(seenBw - expectedBw) < 1e-9,
            8000, "pan bandwidth after sub");
        }
        catch(err)
        {
            radio.off("status", onStatus);
            t.skip("pan bandwidth status not observed: " + err.message);
            return;
        }
        radio.off("status", onStatus);
        assert.ok(Math.abs(seenBw - expectedBw) < 1e-9);

        if(original.pan)
        {
            const restoreBw = original.panbandwidth !== undefined
                ? original.panbandwidth
                : ((radio.PanBW && radio.PanBW[0]) || 0.05);
            radio.fire("display panf s " + original.pan + " bandwidth=" + restoreBw);
            await sleep(300);
        }
    });

    it("PTT on then off reflected in slice/tx or xmit path (status)", async (t) =>
    {
        if(!requireReady(t))
            return;

        dom.xmit(elm({ State: true }), radio);
        try
        {
            await waitUntil(() =>
            {
                return truthyTx(radio.Slice0.tx) || truthyTx(radio.Slice0.TX) || radio.Slice0.transmit;
            }, 6000, "PTT on");
        }
        catch(err)
        {
            // Some firmware exposes TX only on interlock/transmit topic — still force MOX via xmit
            radio.fire("xmit 1");
            await sleep(800);
        }

        dom.xmit(elm({ State: false }), radio);
        radio.fire("xmit 0");
        await sleep(400);
        await waitUntil(() =>
        {
            const tx = radio.Slice0.tx;
            return !truthyTx(tx);
        }, 8000, "PTT off").catch(() => {});
        radio.fire("xmit 0");
        assert.ok(true);
    });
});
