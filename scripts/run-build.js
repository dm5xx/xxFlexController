/**
 * npm run build              → package EXE (no OverlayText bump)
 * npm run build:upversion    → bump OverlayText Build yyyymmddxx, then package
 * npm run build -- --upversion  (also OK; bare `npm run build --upversion` is NOT)
 */
const { spawnSync } = require("child_process");
const path = require("path");

const root = path.join(__dirname, "..");

function envRequestsUpversion(env)
{
    const e = env || process.env;
    // npm run build --upversion → npm_config_upversion (may be "" or "true")
    if(Object.prototype.hasOwnProperty.call(e, "npm_config_upversion"))
        return true;
    // npm_config_argv: {"remain":[],"cooked":["run","build","--upversion"],...}
    try
    {
        if(e.npm_config_argv)
        {
            const parsed = JSON.parse(e.npm_config_argv);
            const cooked = parsed.cooked || parsed.original || [];
            if(cooked.some((a) => String(a) === "--upversion"))
                return true;
        }
    }
    catch(err) {}
    return false;
}

function wantsUpversion(argv, env)
{
    const args = Array.isArray(argv) ? argv : [];
    if(args.includes("--upversion"))
        return true;
    return envRequestsUpversion(env);
}

function runBuild(argv, options)
{
    const opts = options || {};
    const bumpFn = opts.bumpFn || (() => require("./bump-overlay-build.js").bumpOverlayBuild());
    const spawn = opts.spawnSync || spawnSync;
    const exit = opts.exit || ((code) => process.exit(code));
    const log = opts.log || console.log;

    const env = opts.env || process.env;
    const doBump = wantsUpversion(argv, env);
    if(doBump)
    {
        const r = bumpFn();
        log("Bumped OverlayText build: " + (r.oldId || "(none)") + " → " + r.newId);
    }

    if(opts.skipExe)
        return { bumped: doBump, status: 0 };

    const npmCmd = process.platform === "win32" ? "npm.cmd" : "npm";
    const r = spawn(npmCmd, ["run", "build:exe"], {
        cwd: opts.cwd || root,
        stdio: "inherit",
        shell: true
    });
    const status = r.status == null ? 1 : r.status;
    exit(status);
    return { bumped: doBump, status };
}

if(require.main === module)
    runBuild(process.argv.slice(2));

module.exports = { wantsUpversion, runBuild, root };
