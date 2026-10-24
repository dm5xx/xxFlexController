const { describe, it, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const EventEmitter = require("node:events");
const flexDominator = require("../flexdominator.js");
const defaults = require("../public/defaults.json");

function fakeFlex(overrides)
{
    const base = {
        client_handle: "0xABC",
        SliceNumbs: [0, 1],
        PanBW: defaults.PanBW.slice(),
        Filter: defaults.Filter.slice(),
        CWFilter: defaults.CWFilter.slice(),
        Slice0: {
            mode: "USB",
            mode_list: ["USB", "LSB", "CW", "AM", "FM"],
            RF_frequency: 14.2,
            step: 100,
            step_list: [1, 10, 100, 1000],
            filter_lo: 100,
            filter_hi: 2900,
            txant: "ANT1",
            rxant: "ANT1",
            panbandwidth: 0.05,
            tx: false
        },
        Slice1: {
            mode: "CW",
            mode_list: ["USB", "LSB", "CW", "AM"],
            RF_frequency: 7.0,
            step: 10,
            step_list: [1, 10, 100],
            filter_lo: -250,
            filter_hi: 250,
            txant: "ANT1",
            rxant: "ANT1",
            panbandwidth: 0.05,
            tx: false
        }
    };
    return Object.assign(base, overrides || {});
}

function elm(partial)
{
    return Object.assign({ Id: "0|0", Part: "A", State: 0, MappedTo: "" }, partial);
}

describe("flexDominator command strings", () =>
{
    let dom;
    let emitter;

    beforeEach(() =>
    {
        emitter = new EventEmitter();
        dom = new flexDominator(emitter, defaults);
    });

    it("modes advances to next valid mode and skips NotValidModes", () =>
    {
        const flx = fakeFlex();
        flx.Slice0.mode = "USB";
        const cmd = dom.modes(elm({ Part: "A" }), flx);
        assert.equal(flx.Slice0.mode, "LSB");
        assert.equal(cmd, "slice s 0 mode=LSB");
    });

    it("modes skips AM when listed in NotValidModes", () =>
    {
        const flx = fakeFlex();
        flx.Slice0.mode = "CW";
        flx.Slice0.mode_list = ["CW", "AM", "USB"];
        const cmd = dom.modes(elm({ Part: "A" }), flx);
        assert.equal(flx.Slice0.mode, "USB");
        assert.match(cmd, /mode=USB$/);
    });

    it("agc returns slice threshold command", () =>
    {
        const flx = fakeFlex();
        const cmd = dom.agc(elm({ State: 42 }), flx);
        assert.equal(cmd, "slice s 0 agc_threshold=42");
    });

    it("volume uses client_handle and converted gain", () =>
    {
        const flx = fakeFlex();
        const cmd = dom.volume(elm({ State: 127 }), flx);
        assert.equal(cmd, "audio client 0xABC slice 0 gain 100");
    });

    it("vfo up tunes frequency by step", () =>
    {
        const flx = fakeFlex();
        flx.Slice0.RF_frequency = 14.2;
        flx.Slice0.step = 100;
        const cmd = dom.vfo(elm({ State: 1 }), flx);
        assert.ok(Math.abs(flx.Slice0.RF_frequency - 14.2001) < 1e-9);
        assert.equal(cmd, "slice tune 0 " + flx.Slice0.RF_frequency);
    });

    it("toggleTXANT flips ANT1/ANT2", () =>
    {
        const flx = fakeFlex();
        flx.Slice0.txant = "ANT1";
        assert.equal(dom.toggleTXANT(elm({}), flx), "slice s 0 txant=ANT2");
        assert.equal(dom.toggleTXANT(elm({}), flx), "slice s 0 txant=ANT1");
    });

    it("rit at center returns rit off", () =>
    {
        const flx = fakeFlex();
        flx.Slice0.mode = "USB";
        const cmd = dom.rit(elm({ State: 64 }), flx);
        assert.equal(cmd, "slice s 0 rit_on=0 rit_freq=0");
    });

    it("Part B targets slice 1 real index", () =>
    {
        const flx = fakeFlex();
        const cmd = dom.agc(elm({ Part: "B", State: 10 }), flx);
        assert.equal(cmd, "slice s 1 agc_threshold=10");
    });

    it("steps advances step from step_list skipping NotValidSteps", () =>
    {
        const flx = fakeFlex();
        flx.Slice0.step = 10;
        flx.Slice0.step_list = [1, 10, 100, 1000];
        const cmd = dom.steps(elm({}), flx);
        assert.equal(flx.Slice0.step, 100);
        assert.equal(cmd, "slice s 0 step=100");
    });

    it("xmit emits cptt and does not return a fire string", () =>
    {
        const flx = fakeFlex();
        let got = null;
        emitter.on("cptt", (sl, real, state) => { got = { sl, real, state }; });
        const ret = dom.xmit(elm({ State: true }), flx);
        assert.equal(ret, undefined);
        assert.deepEqual(got, { sl: 0, real: 0, state: true });
        assert.equal(flx.Slice0.tx, true);
    });
});
