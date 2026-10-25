const { describe, it, before, after } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const os = require("os");
const http = require("http");

const TEST_PORT = 5599;

function httpJson(method, urlPath, body)
{
    return new Promise((resolve, reject) =>
    {
        const payload = body === undefined ? null : JSON.stringify(body);
        const req = http.request({
            host: "127.0.0.1",
            port: TEST_PORT,
            path: urlPath,
            method,
            headers: payload
                ? { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(payload) }
                : {}
        }, (res) =>
        {
            const chunks = [];
            res.on("data", (c) => chunks.push(c));
            res.on("end", () =>
            {
                const text = Buffer.concat(chunks).toString("utf8");
                let json = null;
                try { json = JSON.parse(text); } catch(e) { json = text; }
                resolve({ status: res.statusCode, json, text });
            });
        });
        req.on("error", reject);
        if(payload)
            req.write(payload);
        req.end();
    });
}

describe("config editor HTTP API", () =>
{
    let tmpRoot;
    let prevCwd;
    let server;
    let configeditor;

    before(() =>
    {
        tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), "hercules-edittest-"));
        const pub = path.join(tmpRoot, "public");
        fs.mkdirSync(pub);
        fs.writeFileSync(path.join(pub, "global.json"), JSON.stringify({
            configs: 1,
            default: 1,
            publicdirnum: 0,
            JsonEditor: true,
            JsonEditorPort: TEST_PORT,
            OverlayText: "",
            OverlayTime: 0,
            Debug: false
        }, null, 4));
        fs.writeFileSync(path.join(pub, "defaults.json"), JSON.stringify({
            CWMakro: ["TEST"],
            NotValidModes: ["AM"],
            NotValidSteps: [1],
            CWFilter: [100, 250],
            Filter: [1200, 1800],
            PanBW: [0.05],
            RitFreq: [1000, 250]
        }, null, 4));
        fs.writeFileSync(path.join(pub, "config1.json"), JSON.stringify({
            FlexIP: "10.0.0.1",
            FlexPort: 4992,
            MidimapFile: "hercules.xlsx",
            WindowsMidiName: "DJControl Starlight",
            StationName: "",
            JogCoolDown: 100
        }, null, 4));

        prevCwd = process.cwd();
        process.chdir(tmpRoot);

        // Load after chdir so PUBLIC_DIR resolves to tmp public/
        delete require.cache[require.resolve("../configeditor.js")];
        delete require.cache[require.resolve("../consolebridge.js")];
        configeditor = require("../configeditor.js");
        server = configeditor.start({
            port: TEST_PORT,
            openBrowser: false,
            fatal: false
        });
    });

    after(() =>
    {
        return new Promise((resolve) =>
        {
            if(server)
                server.close(() => resolve());
            else
                resolve();
        }).finally(() =>
        {
            try { process.chdir(prevCwd); } catch(e) {}
            try { fs.rmSync(tmpRoot, { recursive: true, force: true }); } catch(e) {}
        });
    });

    it("GET /api/meta lists allowed files and overlay settings", async () =>
    {
        // wait briefly for listen
        await new Promise((r) => setTimeout(r, 200));
        const res = await httpJson("GET", "/api/meta");
        assert.equal(res.status, 200);
        assert.ok(Array.isArray(res.json.files));
        assert.ok(res.json.files.includes("config1.json"));
        assert.ok(res.json.files.includes("global.json"));
        assert.equal(res.json.overlayTime, 0);
        assert.equal(typeof res.json.fieldMeta, "object");
    });

    it("GET /api/file/config1.json returns FlexIP", async () =>
    {
        const res = await httpJson("GET", "/api/file/config1.json");
        assert.equal(res.status, 200);
        assert.equal(res.json.data.FlexIP, "10.0.0.1");
    });

    it("PUT /api/file/config1.json persists JSON", async () =>
    {
        const res = await httpJson("PUT", "/api/file/config1.json", {
            FlexIP: "10.0.0.99",
            FlexPort: 4992,
            MidimapFile: "hercules.xlsx",
            WindowsMidiName: "DJControl Starlight",
            StationName: "",
            JogCoolDown: 50
        });
        assert.equal(res.status, 200);
        assert.equal(res.json.ok, true);
        const disk = JSON.parse(fs.readFileSync(path.join(tmpRoot, "public", "config1.json"), "utf8"));
        assert.equal(disk.FlexIP, "10.0.0.99");
        assert.equal(disk.JogCoolDown, 50);
    });

    it("rejects path traversal / non-whitelisted names", async () =>
    {
        const res = await httpJson("GET", "/api/file/" + encodeURIComponent("../package.json"));
        assert.equal(res.status, 403);
        const res2 = await httpJson("GET", "/api/file/secrets.txt");
        assert.equal(res2.status, 403);
    });

    it("GET / serves HTML UI", async () =>
    {
        const res = await new Promise((resolve, reject) =>
        {
            http.get({ host: "127.0.0.1", port: TEST_PORT, path: "/" }, (r) =>
            {
                const chunks = [];
                r.on("data", (c) => chunks.push(c));
                r.on("end", () => resolve({
                    status: r.statusCode,
                    text: Buffer.concat(chunks).toString("utf8")
                }));
            }).on("error", reject);
        });
        assert.equal(res.status, 200);
        assert.match(res.text, /Hercules/i);
        assert.match(res.text, /Terminal/);
    });
});
