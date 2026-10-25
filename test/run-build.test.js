const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { wantsUpversion, runBuild } = require("../scripts/run-build.js");
const { bumpOverlayBuild } = require("../scripts/bump-overlay-build.js");

describe("run-build --upversion", () =>
{
    it("wantsUpversion is true for argv --upversion", () =>
    {
        assert.equal(wantsUpversion(["--upversion"], {}), true);
        assert.equal(wantsUpversion(["--version"], {}), false);
        assert.equal(wantsUpversion([], {}), false);
        assert.equal(wantsUpversion(["--upversion", "--other"], {}), true);
    });

    it("wantsUpversion detects npm run build --upversion via env", () =>
    {
        assert.equal(wantsUpversion([], { npm_config_upversion: "" }), true);
        assert.equal(wantsUpversion([], {
            npm_config_argv: JSON.stringify({
                remain: [],
                cooked: ["run", "build", "--upversion"],
                original: ["run", "build", "--upversion"]
            })
        }), true);
        assert.equal(wantsUpversion([], {
            npm_config_argv: JSON.stringify({ cooked: ["run", "build"] })
        }), false);
    });

    it("runBuild with --upversion calls bump and skips exe when asked", () =>
    {
        let bumped = false;
        const r = runBuild(["--upversion"], {
            skipExe: true,
            env: {},
            bumpFn: () =>
            {
                bumped = true;
                return { oldId: "2026102501", newId: "2026102502" };
            },
            log: () => {}
        });
        assert.equal(bumped, true);
        assert.equal(r.bumped, true);
        assert.equal(r.status, 0);
    });

    it("runBuild without --upversion does not bump", () =>
    {
        let bumped = false;
        const r = runBuild([], {
            skipExe: true,
            env: {},
            bumpFn: () =>
            {
                bumped = true;
                return { oldId: "2026102501", newId: "2026102502" };
            },
            log: () => {}
        });
        assert.equal(bumped, false);
        assert.equal(r.bumped, false);
    });

    it("bumpOverlayBuild writes new Build id into OverlayText JSON", () =>
    {
        const dir = fs.mkdtempSync(path.join(os.tmpdir(), "hercules-bump-"));
        const file = path.join(dir, "global.json");
        fs.writeFileSync(file, JSON.stringify({
            OverlayText: "Hercules Build 2026102501",
            OverlayTime: 2
        }, null, 4));
        const r = bumpOverlayBuild({
            filePath: file,
            now: new Date(2026, 9, 25)
        });
        const saved = JSON.parse(fs.readFileSync(file, "utf8"));
        assert.equal(r.newId, "2026102502");
        assert.match(saved.OverlayText, /Build 2026102502/);
        fs.rmSync(dir, { recursive: true, force: true });
    });
});
