/**
 * Tee process stdout/stderr into a ring buffer + EventEmitter for the browser terminal.
 */
const { EventEmitter } = require("events");

const MAX_LINES = 2500;
const bus = new EventEmitter();
bus.setMaxListeners(50);

const lines = [];
let installed = false;
let outPartial = "";
let errPartial = "";

function pushLine(stream, text)
{
    if(text === "")
        return;
    const entry = { t: Date.now(), stream, text };
    lines.push(entry);
    if(lines.length > MAX_LINES)
        lines.splice(0, lines.length - MAX_LINES);
    bus.emit("line", entry);
}

function ingest(chunk, stream)
{
    const str = typeof chunk === "string" ? chunk : chunk.toString("utf8");
    if(stream === "err")
    {
        errPartial += str;
        const parts = errPartial.split(/\r?\n/);
        errPartial = parts.pop() || "";
        for(const p of parts)
            pushLine("err", p);
    }
    else
    {
        outPartial += str;
        const parts = outPartial.split(/\r?\n/);
        outPartial = parts.pop() || "";
        for(const p of parts)
            pushLine("out", p);
    }
}

function install()
{
    if(installed)
        return;
    installed = true;

    const origOut = process.stdout.write.bind(process.stdout);
    const origErr = process.stderr.write.bind(process.stderr);

    process.stdout.write = function(chunk, encoding, cb)
    {
        try { ingest(chunk, "out"); } catch(e) {}
        return origOut(chunk, encoding, cb);
    };

    process.stderr.write = function(chunk, encoding, cb)
    {
        try { ingest(chunk, "err"); } catch(e) {}
        return origErr(chunk, encoding, cb);
    };
}

function getHistory()
{
    return lines.slice();
}

function subscribe(listener)
{
    bus.on("line", listener);
    return () => bus.off("line", listener);
}

module.exports = { install, getHistory, subscribe, bus };
