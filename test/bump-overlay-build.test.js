const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const {
    todayYyyymmdd,
    nextBuildId,
    applyBump
} = require("../scripts/bump-overlay-build.js");

describe("overlay build bump yyyymmddxx", () =>
{
    it("todayYyyymmdd formats local date", () =>
    {
        const d = new Date(2026, 9, 25); // month 0-based → Oct 25
        assert.equal(todayYyyymmdd(d), "20261025");
    });

    it("same day increments xx", () =>
    {
        const d = new Date(2026, 9, 25);
        assert.equal(nextBuildId("2026102501", d), "2026102502");
        assert.equal(nextBuildId("2026102509", d), "2026102510");
    });

    it("new day resets to 01 with today's date", () =>
    {
        const d = new Date(2026, 9, 26);
        assert.equal(nextBuildId("2026102507", d), "2026102601");
    });

    it("missing id starts today 01", () =>
    {
        const d = new Date(2026, 9, 25);
        assert.equal(nextBuildId(null, d), "2026102501");
    });

    it("applyBump replaces Build token in OverlayText", () =>
    {
        const d = new Date(2026, 9, 25);
        const src = "Hercules Version 1.5 Build 2026102501 - DM5XX";
        const r = applyBump(src, d);
        assert.equal(r.oldId, "2026102501");
        assert.equal(r.newId, "2026102502");
        assert.equal(r.text, "Hercules Version 1.5 Build 2026102502 - DM5XX");
    });

    it("applyBump appends Build when absent", () =>
    {
        const d = new Date(2026, 9, 25);
        const r = applyBump("Hercules", d);
        assert.equal(r.oldId, null);
        assert.equal(r.newId, "2026102501");
        assert.equal(r.text, "Hercules Build 2026102501");
    });
});
