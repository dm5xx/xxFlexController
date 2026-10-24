/**
 * Pack dist/* into ./rh.zip (contents of dist at zip root, not a nested dist/).
 * Lists entries explicitly — Windows tar with "." often yields Explorer-empty zips.
 */
const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

const root = path.join(__dirname, "..");
const dist = path.join(root, "dist");
const zipPath = path.join(root, "rh.zip");

if(!fs.existsSync(dist))
{
    console.error("dist/ missing — run build first");
    process.exit(1);
}

const entries = fs.readdirSync(dist);
if(entries.length === 0)
{
    console.error("dist/ is empty");
    process.exit(1);
}

if(fs.existsSync(zipPath))
    fs.unlinkSync(zipPath);

try
{
    // Explicit names (not ".") so Windows Explorer shows files correctly
    execFileSync("tar", ["-a", "-c", "-f", zipPath, "-C", dist, ...entries], { stdio: "inherit" });
}
catch(err)
{
    console.error("Failed to create rh.zip (is tar available on PATH?)");
    process.exit(1);
}

const sizeMb = (fs.statSync(zipPath).size / (1024 * 1024)).toFixed(1);
console.log("Created rh.zip ("+sizeMb+" MB) in project root");
console.log("Contents: "+entries.join(", "));
