/**
 * Bump OverlayText build id in public/global.json.
 * Format: yyyymmddxx (e.g. Build 2026102501)
 * Same calendar day → xx+1; new day → today's yyyymmdd + 01.
 */
const fs = require("fs");
const path = require("path");

const GLOBAL_PATH = path.join(__dirname, "..", "public", "global.json");
/** Prefer "Build 2026102501"; fallback: any 10-digit 20yymmddxx */
const BUILD_RE = /\bBuild\s+(\d{10})\b/i;
const BARE_RE = /\b(20\d{8})\b/;

function todayYyyymmdd(d)
{
    const dt = d || new Date();
    const y = dt.getFullYear();
    const m = String(dt.getMonth() + 1).padStart(2, "0");
    const day = String(dt.getDate()).padStart(2, "0");
    return String(y) + m + day;
}

function nextBuildId(existingId, now)
{
    const today = todayYyyymmdd(now);
    if(!existingId || !/^\d{10}$/.test(String(existingId)))
        return today + "01";

    const id = String(existingId);
    const datePart = id.slice(0, 8);
    const seqPart = parseInt(id.slice(8, 10), 10);

    if(datePart === today)
    {
        const next = (Number.isFinite(seqPart) ? seqPart : 0) + 1;
        if(next > 99)
            throw new Error("Build sequence xx exceeds 99 for " + today);
        return today + String(next).padStart(2, "0");
    }
    return today + "01";
}

function findBuildId(overlayText)
{
    const text = typeof overlayText === "string" ? overlayText : "";
    let m = text.match(BUILD_RE);
    if(m)
        return { id: m[1], index: m.index, length: m[0].length, hasBuildPrefix: true, full: m[0] };
    m = text.match(BARE_RE);
    if(m)
        return { id: m[1], index: m.index, length: m[0].length, hasBuildPrefix: false, full: m[0] };
    return null;
}

function applyBump(overlayText, now)
{
    const text = typeof overlayText === "string" ? overlayText : "";
    const found = findBuildId(text);
    const newId = nextBuildId(found ? found.id : null, now);

    if(found)
    {
        const replacement = found.hasBuildPrefix
            ? found.full.replace(found.id, newId)
            : newId;
        const next = text.slice(0, found.index) + replacement + text.slice(found.index + found.length);
        return { text: next, oldId: found.id, newId };
    }

    const sep = text.length && !/\s$/.test(text) ? " " : "";
    return {
        text: text + sep + "Build " + newId,
        oldId: null,
        newId
    };
}

function bumpOverlayBuild(options)
{
    const opts = options || {};
    const filePath = opts.filePath || GLOBAL_PATH;
    const now = opts.now || new Date();
    const dryRun = opts.dryRun === true;

    if(!fs.existsSync(filePath))
        throw new Error("Missing " + filePath);

    const raw = fs.readFileSync(filePath, "utf8");
    const data = JSON.parse(raw);
    if(typeof data.OverlayText !== "string")
        data.OverlayText = "";

    const result = applyBump(data.OverlayText, now);
    data.OverlayText = result.text;

    if(!dryRun)
        fs.writeFileSync(filePath, JSON.stringify(data, null, 4) + "\n", "utf8");

    return {
        filePath,
        oldId: result.oldId,
        newId: result.newId,
        overlayText: result.text
    };
}

if(require.main === module)
{
    try
    {
        const r = bumpOverlayBuild();
        console.log("Overlay build: " + (r.oldId || "(none)") + " → " + r.newId);
        console.log("OverlayText: " + r.overlayText);
    }
    catch(err)
    {
        console.error(err.message || err);
        process.exit(1);
    }
}

module.exports = {
    todayYyyymmdd,
    nextBuildId,
    findBuildId,
    applyBump,
    bumpOverlayBuild,
    GLOBAL_PATH
};
