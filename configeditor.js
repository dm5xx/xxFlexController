/**
 * Localhost-only browser UI: live console terminal + JSON config editor.
 * Start: node configeditor.js  |  node app.js --editor  |  xxHercules.exe --editor
 */
const http = require("http");
const fs = require("fs");
const path = require("path");
const { exec, spawn } = require("child_process");
const consolebridge = require("./consolebridge.js");
const crashguard = require("./crashguard.js");

const HOST = "127.0.0.1";
const DEFAULT_PORT = 5555;
const PUBLIC_DIR = path.join(process.cwd(), "public");

let restarting = false;

const ALLOWED = new Set([
    "global.json",
    "defaults.json",
    "config1.json",
    "config2.json",
    "config3.json",
    "config4.json",
    "config5.json",
    "config6.json",
    "config7.json",
    "config8.json"
]);

/** Optional nicer labels/hints; form fields are always built from the JSON keys. */
const FIELD_META = {
    FlexIP: { label: "Flex IP", hint: "Radio IP address" },
    FlexPort: { label: "Flex Port", hint: "Usually 4992 (TCP). Do not confuse with UDP discovery." },
    FlexDiscovery: { label: "Flex UDP discovery", hint: "Bind UDP 4992 for gui_client_ips (MultiFlex IP filter). Default off — on Win10 can close AetherSDR/SmartSDR if the GUI started first" },
    MidimapFile: { label: "Midimap file", hint: "e.g. hercules.xlsx" },
    WindowsMidiName: { label: "MIDI device name", hint: "As shown by the OS" },
    StationName: { label: "Station name", hint: "Empty = auto / computer name" },
    JogCoolDown: { label: "Jog cool-down (ms)", hint: "Throttle jog wheel" },
    Debug: { label: "Debug logging", hint: "Extra console output (global.json)" },
    configs: { label: "Configs count", hint: "How many config slots you use" },
    default: { label: "Default config #", hint: "configN loaded at startup" },
    publicdirnum: { label: "Public dir number", hint: "0 = public/, N = publicN/" },
    JsonEditor: { label: "JSON editor", hint: "Start browser UI with the app" },
    JsonEditorPort: { label: "JSON editor port", hint: "Localhost port (default 5555); restart app after change" },
    OverlayText: { label: "Startup overlay text", hint: "Shown on open; empty = no overlay. Use \\n for new lines" },
    OverlayTime: { label: "Overlay time (s)", hint: "Seconds before overlay closes (default 4; 0 = off)" },
    CWMakro: { label: "CW macros", hint: "Comma-separated" },
    NotValidModes: { label: "Not valid modes", hint: "Comma-separated mode names" },
    NotValidSteps: { label: "Not valid steps", hint: "Comma-separated numbers" },
    CWFilter: { label: "CW filters", hint: "Comma-separated Hz" },
    Filter: { label: "Phone filters", hint: "Comma-separated Hz" },
    PanBW: { label: "Panadapter BW", hint: "Comma-separated MHz values" },
    RitFreq: { label: "RIT frequencies", hint: "Comma-separated Hz (phone, CW)" }
};

function safeName(name)
{
    if(typeof name !== "string")
        return null;
    const base = path.basename(name);
    if(!ALLOWED.has(base))
        return null;
    return base;
}

function filePath(name)
{
    return path.join(PUBLIC_DIR, name);
}

function sendJson(res, status, obj)
{
    const body = JSON.stringify(obj);
    res.writeHead(status, {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Length": Buffer.byteLength(body)
    });
    res.end(body);
}

function readBody(req)
{
    return new Promise((resolve, reject) =>
    {
        const chunks = [];
        req.on("data", (c) => chunks.push(c));
        req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
        req.on("error", reject);
    });
}

function listFiles()
{
    return [...ALLOWED].filter((n) => fs.existsSync(filePath(n)));
}

function quoteWin(arg)
{
    const s = String(arg);
    if(!/[ \t"]/g.test(s))
        return s;
    return "\"" + s.replace(/"/g, "\\\"") + "\"";
}

function restartArgs()
{
    // Drop argv[0] (node/exe). Keep script + flags. Ignore pkg snapshot paths.
    return process.argv.slice(1).filter((a) =>
    {
        if(!a || a === process.execPath)
            return false;
        if(String(a).includes("snapshot"))
            return false;
        return true;
    });
}

/** Relaunch in a new console after a short delay so MIDI/port are free. */
function scheduleRestart()
{
    const exe = process.execPath;
    const args = restartArgs();
    const cwd = process.cwd();
    const os = require("os");
    const batPath = path.join(os.tmpdir(), "hercules-restart-" + process.pid + ".cmd");

    console.log("Config editor: scheduling restart → " + exe + " " + args.join(" "));

    if(process.platform === "win32")
    {
        const argList = args.map((a) => "'" + String(a).replace(/'/g, "''") + "'").join(",");
        const exeQ = String(exe).replace(/'/g, "''");
        const cwdQ = String(cwd).replace(/'/g, "''");
        const ps = [
            "Start-Sleep -Seconds 2;",
            "Start-Process -FilePath '" + exeQ + "'",
            args.length ? (" -ArgumentList @(" + argList + ")") : "",
            " -WorkingDirectory '" + cwdQ + "'",
            " -WindowStyle Normal"
        ].join("");
        const lines = [
            "@echo off",
            "powershell.exe -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -Command " + quoteWin(ps),
            "del " + quoteWin(batPath)
        ];
        fs.writeFileSync(batPath, lines.join("\r\n"), "utf8");
        spawn(process.env.ComSpec || "cmd.exe", ["/c", batPath], {
            detached: true,
            stdio: "ignore",
            cwd,
            windowsHide: true
        }).unref();
    }
    else
    {
        const shArgs = args.map((a) => "'" + String(a).replace(/'/g, "'\\''") + "'").join(" ");
        spawn("sh", ["-c", "sleep 2; cd '" + cwd.replace(/'/g, "'\\''") + "' && exec '" + exe.replace(/'/g, "'\\''") + "' " + shArgs], {
            detached: true,
            stdio: "ignore",
            cwd,
            env: process.env
        }).unref();
    }

    restarting = true;
    setTimeout(() => process.exit(0), 500);
}

function handleConsoleStream(req, res)
{
    consolebridge.install();
    res.writeHead(200, {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive"
    });
    if(typeof res.flushHeaders === "function")
        res.flushHeaders();

    const send = (entry) =>
    {
        try { res.write("data: " + JSON.stringify(entry) + "\n\n"); } catch(e) {}
    };

    for(const entry of consolebridge.getHistory())
        send(entry);

    res.write(": connected\n\n");

    const unsub = consolebridge.subscribe(send);
    const heartbeat = setInterval(() =>
    {
        try { res.write(": ping\n\n"); } catch(e) {}
    }, 15000);

    let cleaned = false;
    const cleanup = () =>
    {
        if(cleaned)
            return;
        cleaned = true;
        clearInterval(heartbeat);
        unsub();
    };
    req.on("close", cleanup);
    res.on("close", cleanup);
}

async function handleApi(req, res, url)
{
    if(url.pathname === "/api/console" && req.method === "GET")
        return handleConsoleStream(req, res);

    if(url.pathname === "/api/meta" && req.method === "GET")
    {
        let overlayText = "";
        let overlayTime = 4;
        try
        {
            const g = JSON.parse(fs.readFileSync(path.join(PUBLIC_DIR, "global.json"), "utf8"));
            if(typeof g.OverlayText === "string")
                overlayText = g.OverlayText;
            if(g.OverlayTime != null && Number.isFinite(Number(g.OverlayTime)))
                overlayTime = Number(g.OverlayTime);
        }
        catch(e) {}
        return sendJson(res, 200, {
            publicDir: PUBLIC_DIR,
            fieldMeta: FIELD_META,
            files: listFiles(),
            overlayText,
            overlayTime
        });
    }

    if(url.pathname === "/api/restart" && req.method === "POST")
    {
        restarting = true;
        sendJson(res, 200, { ok: true, restarting: true });
        console.log("Config editor: restart requested — relaunching Hercules…");
        setTimeout(scheduleRestart, 150);
        return;
    }

    if(url.pathname === "/api/files" && req.method === "GET")
        return sendJson(res, 200, { files: listFiles() });

    const fileMatch = url.pathname.match(/^\/api\/file\/([^/]+)$/);
    if(fileMatch)
    {
        const name = safeName(decodeURIComponent(fileMatch[1]));
        if(!name)
            return sendJson(res, 403, { error: "File not allowed" });

        const full = filePath(name);
        if(req.method === "GET")
        {
            if(!fs.existsSync(full))
                return sendJson(res, 404, { error: "Not found" });
            try
            {
                const data = JSON.parse(fs.readFileSync(full, "utf8"));
                return sendJson(res, 200, { name, data });
            }
            catch(err)
            {
                return sendJson(res, 500, { error: "Invalid JSON on disk: " + err.message });
            }
        }

        if(req.method === "PUT")
        {
            try
            {
                const raw = await readBody(req);
                const parsed = JSON.parse(raw);
                const pretty = JSON.stringify(parsed, null, 4) + "\n";
                fs.writeFileSync(full, pretty, "utf8");
                return sendJson(res, 200, { ok: true, name });
            }
            catch(err)
            {
                return sendJson(res, 400, { error: err.message || String(err) });
            }
        }
    }

    sendJson(res, 404, { error: "Not found" });
}

function pageHtml()
{
    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>Hercules</title>
<link rel="preconnect" href="https://fonts.googleapis.com"/>
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin/>
<link href="https://fonts.googleapis.com/css2?family=Outfit:wght@400;600;700&family=IBM+Plex+Mono:wght@400;500&display=swap" rel="stylesheet"/>
<style>
:root {
  --bg0: #0b0d10;
  --bg1: #12161c;
  --bg2: #1a212b;
  --line: rgba(50, 205, 50, 0.2);
  --text: #f2efe8;
  --muted: #9aa3ad;
  --accent: #32cd32;
  --accent-dim: #228b22;
  --ok: #6fbf8a;
  --err: #e07a6a;
  --focus: #32cd32;
  --term-bg: #07090c;
  --term-fg: #d7e0c8;
}
* { box-sizing: border-box; }
html {
  margin: 0;
  min-height: 100%;
  background-color: var(--bg0);
}
body {
  margin: 0;
  min-height: 100vh;
  min-height: 100dvh;
  font-family: "Outfit", system-ui, sans-serif;
  color: var(--text);
  background-color: var(--bg0);
  background-image:
    radial-gradient(1200px 600px at 10% -10%, rgba(50,205,50,0.12), transparent 55%),
    radial-gradient(900px 500px at 100% 0%, rgba(80,120,160,0.14), transparent 50%),
    linear-gradient(165deg, var(--bg0), #10141a 45%, #0a0c0f);
  background-attachment: fixed;
  background-repeat: no-repeat;
  background-size: cover;
}
.app {
  max-width: 1100px;
  margin: 0 auto;
  padding: 2.5rem 1.25rem 3rem;
  display: grid;
  gap: 0;
}
header {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem 1.5rem;
  border-bottom: 1px solid var(--line);
  padding-bottom: 1.25rem;
  margin-bottom: 0;
}
.header-right {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.65rem;
  justify-content: flex-end;
}
.brand {
  font-size: clamp(1.75rem, 3vw, 2.35rem);
  font-weight: 700;
  letter-spacing: -0.03em;
  margin: 0;
}
.brand span { color: var(--accent); }
.sub {
  margin: 0.35rem 0 0;
  color: var(--muted);
  font-size: 0.95rem;
  max-width: 36rem;
}
.path {
  font-family: "IBM Plex Mono", monospace;
  font-size: 0.75rem;
  color: var(--muted);
  background: var(--bg1);
  border: 1px solid var(--line);
  border-radius: 8px;
  padding: 0.55rem 0.75rem;
}
.menubar {
  display: flex;
  gap: 0.35rem;
  padding: 0.85rem 0 1.15rem;
  border-bottom: 1px solid transparent;
}
.menubar button {
  font: inherit;
  font-weight: 600;
  font-size: 0.92rem;
  color: var(--muted);
  background: transparent;
  border: 0;
  border-bottom: 2px solid transparent;
  padding: 0.45rem 0.85rem;
  cursor: pointer;
  border-radius: 8px 8px 0 0;
}
.menubar button:hover { color: var(--text); background: rgba(255,255,255,0.03); }
.menubar button.active {
  color: var(--accent);
  border-bottom-color: var(--accent);
}
.tab-panel { display: none; padding-top: 1.15rem; }
.tab-panel.active { display: block; }
.layout {
  display: grid;
  grid-template-columns: 220px 1fr;
  gap: 1.25rem;
  align-items: start;
}
@media (max-width: 800px) {
  .layout { grid-template-columns: 1fr; }
}
.nav {
  background: rgba(18,22,28,0.85);
  border: 1px solid var(--line);
  border-radius: 14px;
  padding: 0.75rem;
  backdrop-filter: blur(8px);
}
.nav h2 {
  margin: 0.25rem 0.5rem 0.75rem;
  font-size: 0.7rem;
  text-transform: uppercase;
  letter-spacing: 0.12em;
  color: var(--muted);
  font-weight: 600;
}
.nav button {
  display: block;
  width: 100%;
  text-align: left;
  font: inherit;
  color: var(--text);
  background: transparent;
  border: 0;
  border-radius: 8px;
  padding: 0.55rem 0.7rem;
  cursor: pointer;
  margin-bottom: 0.2rem;
}
.nav button:hover { background: var(--bg2); }
.nav button.active {
  background: linear-gradient(90deg, rgba(50,205,50,0.22), rgba(50,205,50,0.06));
  color: var(--accent);
  font-weight: 600;
}
.panel {
  background: rgba(18,22,28,0.9);
  border: 1px solid var(--line);
  border-radius: 14px;
  padding: 1.25rem 1.35rem 1.5rem;
  min-height: 420px;
  backdrop-filter: blur(8px);
}
.panel-head {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  margin-bottom: 1.25rem;
}
.panel-head h2 {
  margin: 0;
  font-size: 1.15rem;
  font-weight: 600;
}
.actions { display: flex; flex-wrap: wrap; gap: 0.5rem; align-items: center; }
button.primary, button.ghost {
  font: inherit;
  font-weight: 600;
  border-radius: 999px;
  padding: 0.55rem 1.1rem;
  cursor: pointer;
  border: 1px solid transparent;
}
button.primary {
  background: var(--accent);
  color: #061208;
}
button.primary:hover { filter: brightness(1.05); }
button.primary:disabled { opacity: 0.5; cursor: default; }
button.ghost {
  background: transparent;
  color: var(--text);
  border-color: var(--line);
}
button.ghost:hover { border-color: var(--accent-dim); color: var(--accent); }
button.restart {
  background: transparent;
  color: var(--text);
  border: 1px solid var(--accent);
  font: inherit;
  font-weight: 600;
  border-radius: 999px;
  padding: 0.55rem 1.1rem;
  cursor: pointer;
}
button.restart:hover {
  border-color: var(--accent);
  color: var(--accent);
  background: rgba(50, 205, 50, 0.1);
}
button.restart:disabled { opacity: 0.5; cursor: default; }
.toast {
  font-size: 0.85rem;
  min-height: 1.2em;
  color: var(--muted);
}
.toast.ok { color: var(--ok); }
.toast.err { color: var(--err); }
.form { display: grid; gap: 1rem; }
.field label {
  display: block;
  font-size: 0.8rem;
  font-weight: 600;
  margin-bottom: 0.35rem;
}
.field .hint {
  color: var(--muted);
  font-weight: 400;
  font-size: 0.75rem;
  margin-left: 0.35rem;
}
.field input[type="text"],
.field input[type="number"],
.field textarea {
  width: 100%;
  font: inherit;
  color: var(--text);
  background: var(--bg0);
  border: 1px solid var(--line);
  border-radius: 10px;
  padding: 0.65rem 0.8rem;
  outline: none;
}
.field input:focus, .field textarea:focus {
  border-color: var(--focus);
  box-shadow: 0 0 0 3px rgba(50,205,50,0.18);
}
.field textarea {
  font-family: "IBM Plex Mono", monospace;
  font-size: 0.82rem;
  line-height: 1.45;
  min-height: 4.5rem;
  resize: vertical;
  tab-size: 2;
}
.field textarea#jsonArea { min-height: 360px; }
.toggle {
  display: flex;
  align-items: center;
  gap: 0.65rem;
  margin-top: 0.15rem;
}
.toggle input {
  width: 1.15rem;
  height: 1.15rem;
  accent-color: var(--accent-dim);
}
.empty {
  color: var(--muted);
  padding: 2rem 0;
  text-align: center;
}
.term-wrap {
  background: var(--term-bg);
  border: 1px solid var(--line);
  border-radius: 14px;
  overflow: hidden;
  box-shadow: inset 0 0 0 1px rgba(255,255,255,0.03);
}
.term-chrome {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  padding: 0.55rem 0.85rem;
  background: #0e1218;
  border-bottom: 1px solid rgba(255,255,255,0.06);
}
.term-chrome .dots { display: flex; gap: 0.35rem; }
.term-chrome .dot {
  width: 0.55rem;
  height: 0.55rem;
  border-radius: 50%;
  background: #3a424e;
}
.term-chrome .dot.r { background: #c96b5d; }
.term-chrome .dot.y { background: #c9a35d; }
.term-chrome .dot.g { background: #6fbf8a; }
.term-title {
  font-family: "IBM Plex Mono", monospace;
  font-size: 0.72rem;
  color: var(--muted);
}
.term-status {
  font-family: "IBM Plex Mono", monospace;
  font-size: 0.7rem;
  color: var(--muted);
}
.term-status.live {
  color: var(--ok);
  animation: livePulse 2s ease-in-out infinite;
}
.term-status.dead {
  color: var(--err);
  animation: none;
  opacity: 1;
}
@keyframes livePulse {
  0%, 100% { opacity: 0.2; }
  50% { opacity: 1; }
}
.term {
  margin: 0;
  padding: 0.85rem 1rem 1.1rem;
  min-height: min(58vh, 560px);
  max-height: min(70vh, 720px);
  overflow: auto;
  font-family: "IBM Plex Mono", monospace;
  font-size: 0.8rem;
  line-height: 1.45;
  color: var(--term-fg);
  white-space: pre-wrap;
  word-break: break-word;
}
.term .line-err { color: #f0a090; }
.term .line-out { color: var(--term-fg); }
.overlay {
  position: fixed;
  inset: 0;
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1.5rem;
  background: rgba(8, 10, 14, 0.72);
  backdrop-filter: blur(6px);
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.35s ease;
}
.overlay.show {
  opacity: 1;
  pointer-events: auto;
}
.overlay-card {
  max-width: 28rem;
  width: 100%;
  background: var(--bg1);
  border: 1px solid var(--accent);
  border-radius: 14px;
  padding: 1.35rem 1.5rem 1.25rem;
  box-shadow: 0 12px 40px rgba(0,0,0,0.45);
}
.overlay-card p {
  margin: 0;
  font-size: 1rem;
  line-height: 1.45;
  color: var(--text);
  white-space: pre-wrap;
}
.overlay-card .overlay-hint {
  margin-top: 0.85rem;
  font-size: 0.78rem;
  color: var(--muted);
}
</style>
</head>
<body>
<div class="overlay" id="infoOverlay" hidden>
  <div class="overlay-card">
    <p id="overlayText"></p>
    <div class="overlay-hint" id="overlayHint"></div>
  </div>
</div>
<div class="app">
  <header>
    <div>
      <h1 class="brand">Hercules <span>Console</span></h1>
      <p class="sub">Live app output and config files under <code>public/</code> — localhost only.</p>
    </div>
    <div class="header-right">
      <div class="path" id="publicPath">…</div>
      <button type="button" class="restart" id="btnRestart" title="Restart Hercules and close this tab">Restart App</button>
    </div>
  </header>

  <nav class="menubar" aria-label="Main">
    <button type="button" class="active" data-tab="terminal" id="tabBtnTerminal">Terminal</button>
    <button type="button" data-tab="configs" id="tabBtnConfigs">Configs</button>
  </nav>

  <section class="tab-panel active" id="tabTerminal">
    <div class="term-wrap">
      <div class="term-chrome">
        <div class="dots" aria-hidden="true">
          <span class="dot r"></span><span class="dot y"></span><span class="dot g"></span>
        </div>
        <div class="term-title">hercules — console</div>
        <div class="term-status" id="termStatus">connecting…</div>
      </div>
      <pre class="term" id="term" aria-live="polite"></pre>
    </div>
  </section>

  <section class="tab-panel" id="tabConfigs">
    <div class="layout">
      <nav class="nav" id="fileNav" aria-label="Config files">
        <h2>Files</h2>
      </nav>
      <section class="panel">
        <div class="panel-head">
          <h2 id="fileTitle">Select a file</h2>
          <div class="actions">
            <span class="toast" id="toast"></span>
            <button type="button" class="ghost" id="btnReload" disabled>Reload</button>
            <button type="button" class="primary" id="btnSave" disabled>Save</button>
          </div>
        </div>
        <div id="editor" class="empty">Choose a config file on the left.</div>
      </section>
    </div>
  </section>
</div>
<script>
const state = {
  files: [], fieldMeta: {}, fields: [], current: null, mode: null, data: null,
  tab: "terminal", configsLoaded: false, stickBottom: true
};

const el = (id) => document.getElementById(id);
const toast = (msg, kind) => {
  const t = el("toast");
  t.textContent = msg || "";
  t.className = "toast" + (kind ? " " + kind : "");
};

async function api(path, opts) {
  const res = await fetch(path, opts);
  const json = await res.json().catch(() => ({}));
  if(!res.ok) throw new Error(json.error || res.statusText);
  return json;
}

function humanizeKey(key) {
  return String(key)
    .replace(/_/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/^./, (c) => c.toUpperCase());
}

function fieldsFromData(data) {
  if(!data || typeof data !== "object" || Array.isArray(data))
    return [];
  return Object.keys(data).map((key) => {
    const v = data[key];
    const meta = state.fieldMeta[key] || {};
    const label = meta.label || humanizeKey(key);
    const hint = meta.hint || "";
    if(typeof v === "boolean")
      return { key, label, hint, type: "boolean" };
    if(typeof v === "number")
      return { key, label, hint, type: "number" };
    if(Array.isArray(v)) {
      const item = v.length > 0 && typeof v[0] === "number" ? "number" : "string";
      return { key, label, hint: hint || "Comma-separated", type: "array", item };
    }
    if(v !== null && typeof v === "object")
      return { key, label, hint: hint || "JSON object", type: "json" };
    return { key, label, hint, type: "text" };
  });
}

function arrayToText(v) {
  return Array.isArray(v) ? v.join(", ") : (v === undefined || v === null ? "" : String(v));
}

function textToArray(text, item) {
  const parts = String(text).split(/[,;\\n]/).map((s) => s.trim()).filter((s) => s.length);
  if(item === "number") return parts.map((p) => Number(p));
  return parts;
}

function setTab(name) {
  state.tab = name;
  document.querySelectorAll(".menubar button").forEach((b) => {
    b.classList.toggle("active", b.dataset.tab === name);
  });
  el("tabTerminal").classList.toggle("active", name === "terminal");
  el("tabConfigs").classList.toggle("active", name === "configs");
  if(name === "configs" && !state.configsLoaded) {
    state.configsLoaded = true;
    if(state.files.includes("config1.json")) openFile("config1.json");
    else if(state.files[0]) openFile(state.files[0]);
  }
  if(name === "terminal") {
    const term = el("term");
    term.scrollTop = term.scrollHeight;
  }
}

function renderNav() {
  const nav = el("fileNav");
  nav.querySelectorAll("button").forEach((b) => b.remove());
  state.files.forEach((name) => {
    const b = document.createElement("button");
    b.type = "button";
    b.textContent = name;
    if(name === state.current) b.classList.add("active");
    b.addEventListener("click", () => openFile(name));
    nav.appendChild(b);
  });
}

function renderForm(data) {
  const wrap = document.createElement("div");
  wrap.className = "form";
  wrap.id = "formRoot";
  if(!state.fields.length) {
    const empty = document.createElement("div");
    empty.className = "empty";
    empty.textContent = "No keys in this JSON file.";
    wrap.appendChild(empty);
    return wrap;
  }
  state.fields.forEach((f) => {
    const field = document.createElement("div");
    field.className = "field";
    const label = document.createElement("label");
    label.htmlFor = "f_" + f.key;
    label.innerHTML = f.label + (f.hint ? '<span class="hint">' + f.hint + "</span>" : "");
    field.appendChild(label);
    if(f.type === "boolean") {
      const row = document.createElement("div");
      row.className = "toggle";
      const input = document.createElement("input");
      input.type = "checkbox";
      input.id = "f_" + f.key;
      input.checked = !!data[f.key];
      const span = document.createElement("span");
      span.textContent = "Enabled";
      row.appendChild(input);
      row.appendChild(span);
      field.appendChild(row);
    } else if(f.type === "array" || f.type === "json") {
      const ta = document.createElement("textarea");
      ta.id = "f_" + f.key;
      ta.spellcheck = false;
      ta.rows = f.type === "json" ? 6 : (f.key === "CWMakro" ? 3 : 2);
      ta.value = f.type === "json"
        ? JSON.stringify(data[f.key], null, 2)
        : arrayToText(data[f.key]);
      field.appendChild(ta);
    } else {
      const input = document.createElement("input");
      input.id = "f_" + f.key;
      input.type = f.type === "number" ? "number" : "text";
      if(f.type === "number") input.step = "any";
      const v = data[f.key];
      input.value = v === undefined || v === null ? "" : v;
      field.appendChild(input);
    }
    wrap.appendChild(field);
  });
  return wrap;
}

function collectPayload() {
  const out = {};
  state.fields.forEach((f) => {
    const input = document.getElementById("f_" + f.key);
    if(!input) return;
    if(f.type === "boolean") out[f.key] = input.checked;
    else if(f.type === "number") {
      const n = Number(input.value);
      out[f.key] = input.value === "" || Number.isNaN(n) ? input.value : n;
    } else if(f.type === "array") out[f.key] = textToArray(input.value, f.item || "string");
    else if(f.type === "json") out[f.key] = JSON.parse(input.value);
    else out[f.key] = input.value;
  });
  return out;
}

async function openFile(name) {
  toast("");
  const { data } = await api("/api/file/" + encodeURIComponent(name));
  state.current = name;
  state.data = data;
  state.fields = fieldsFromData(data);
  state.mode = "form";
  el("fileTitle").textContent = name;
  el("btnSave").disabled = false;
  el("btnReload").disabled = false;
  const editor = el("editor");
  editor.className = "";
  editor.innerHTML = "";
  editor.appendChild(renderForm(data));
  renderNav();
}

async function save() {
  if(!state.current) return;
  try {
    const payload = collectPayload();
    await api("/api/file/" + encodeURIComponent(state.current), {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    state.data = payload;
    toast("Saved.", "ok");
  } catch(err) {
    toast(err.message || String(err), "err");
  }
}

async function restart() {
  const btn = el("btnRestart");
  btn.disabled = true;
  toast("Restarting Hercules…", "ok");
  try {
    await api("/api/restart", { method: "POST" });
  } catch(err) {}
  // Keep this tab until the process dies; avoid racing a second blank tab.
  document.body.innerHTML = '<div class="app"><p class="empty">Hercules is restarting — this tab will go idle. A new window opens in a moment.</p></div>';
  setTimeout(() => {
    try { window.close(); } catch(e) {}
  }, 1500);
}

function appendTermLine(entry) {
  const term = el("term");
  const nearBottom = term.scrollHeight - term.scrollTop - term.clientHeight < 48;
  const line = document.createElement("div");
  line.className = entry.stream === "err" ? "line-err" : "line-out";
  line.textContent = entry.text;
  term.appendChild(line);
  if(state.stickBottom || nearBottom)
    term.scrollTop = term.scrollHeight;
}

function connectConsole() {
  const status = el("termStatus");
  const es = new EventSource("/api/console");
  es.onopen = () => {
    status.textContent = "live";
    status.className = "term-status live";
  };
  es.onmessage = (ev) => {
    try {
      appendTermLine(JSON.parse(ev.data));
    } catch(e) {}
  };
  es.onerror = () => {
    status.textContent = "disconnected";
    status.className = "term-status dead";
  };
}

function showInfoOverlay(text, seconds) {
  const raw = typeof text === "string" ? text.trim() : "";
  const secs = Number(seconds);
  if(!raw || !Number.isFinite(secs) || secs <= 0)
    return;
  const overlay = el("infoOverlay");
  const body = el("overlayText");
  const hint = el("overlayHint");
  body.textContent = raw.replace(/\\\\n/g, "\\n");
  hint.textContent = "Disappears in " + secs + "s — click to dismiss";
  overlay.hidden = false;
  requestAnimationFrame(() => overlay.classList.add("show"));
  const dismiss = () => {
    overlay.classList.remove("show");
    setTimeout(() => { overlay.hidden = true; }, 400);
    overlay.removeEventListener("click", dismiss);
  };
  overlay.addEventListener("click", dismiss);
  setTimeout(dismiss, secs * 1000);
}

async function init() {
  const meta = await api("/api/meta");
  state.files = meta.files;
  state.fieldMeta = meta.fieldMeta || {};
  el("publicPath").textContent = meta.publicDir;
  renderNav();
  el("btnSave").addEventListener("click", save);
  el("btnReload").addEventListener("click", () => state.current && openFile(state.current));
  el("btnRestart").addEventListener("click", restart);
  document.querySelectorAll(".menubar button").forEach((b) => {
    b.addEventListener("click", () => setTab(b.dataset.tab));
  });
  const term = el("term");
  term.addEventListener("scroll", () => {
    state.stickBottom = term.scrollHeight - term.scrollTop - term.clientHeight < 48;
  });
  connectConsole();
  setTab("terminal");
  showInfoOverlay(meta.overlayText, meta.overlayTime);
}

init().catch((err) => {
  const status = el("termStatus");
  if(status) {
    status.textContent = err.message || String(err);
    status.className = "term-status dead";
  }
});
</script>
</body>
</html>`;
}

function resolvePort(opts)
{
    if(opts && opts.port != null)
    {
        const n = Number(opts.port);
        if(Number.isFinite(n) && n > 0)
            return n;
    }
    try
    {
        const globalPath = path.join(PUBLIC_DIR, "global.json");
        if(fs.existsSync(globalPath))
        {
            const g = JSON.parse(fs.readFileSync(globalPath, "utf8"));
            if(g.JsonEditorPort != null)
            {
                const n = Number(g.JsonEditorPort);
                if(Number.isFinite(n) && n > 0)
                    return n;
            }
        }
    }
    catch(e) {}
    return DEFAULT_PORT;
}

function start(options)
{
    const opts = options || {};
    const openBrowser = opts.openBrowser !== false;
    const fatal = opts.fatal !== false;
    const port = resolvePort(opts);
    restarting = false;

    consolebridge.install();

    if(!fs.existsSync(PUBLIC_DIR))
    {
        console.error("public/ not found at " + PUBLIC_DIR);
        console.error("Run from the folder that contains public/ (e.g. dist/).");
        if(fatal)
            crashguard.holdOpen("public/ missing");
        return null;
    }

    const server = http.createServer(async (req, res) =>
    {
        try
        {
            const url = new URL(req.url || "/", "http://" + HOST + ":" + port);
            if(url.pathname.startsWith("/api/"))
                return await handleApi(req, res, url);

            if(url.pathname === "/" || url.pathname === "/index.html")
            {
                const html = pageHtml();
                res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
                return res.end(html);
            }

            res.writeHead(404).end("Not found");
        }
        catch(err)
        {
            console.error(err);
            if(!res.headersSent)
                sendJson(res, 500, { error: err.message || String(err) });
        }
    });

    server.on("error", (err) =>
    {
        if(err.code === "EADDRINUSE")
            console.error("Config editor: port " + port + " already in use — open http://" + HOST + ":" + port + "/");
        else
            console.error("Config editor: " + (err.message || err));
        if(fatal)
            crashguard.holdOpen(err);
    });

    server.listen(port, HOST, () =>
    {
        const url = "http://" + HOST + ":" + port + "/";
        console.log("Hercules config editor: " + url);
        console.log("Editing folder: " + PUBLIC_DIR);
        if(fatal)
            console.log("Press Ctrl+C to stop.");
        if(openBrowser)
        {
            const cmd = process.platform === "win32" ? ("start \"\" \"" + url + "\"")
                : process.platform === "darwin" ? ("open \"" + url + "\"")
                : ("xdg-open \"" + url + "\"");
            exec(cmd, () => {});
        }
    });

    server.herculesPort = port;
    return server;
}

if(require.main === module)
{
    crashguard.install();
    start();
}

module.exports = { start, DEFAULT_PORT, HOST };
