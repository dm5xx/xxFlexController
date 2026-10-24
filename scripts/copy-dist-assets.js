/**
 * Copy editable runtime files next to the pkg EXE.
 * Config/Excel stay outside the binary so users can edit them.
 */
const fs = require("fs");
const path = require("path");

function copyDir(src, dest)
{
    fs.mkdirSync(dest, { recursive: true });
    for(const entry of fs.readdirSync(src, { withFileTypes: true }))
    {
        const from = path.join(src, entry.name);
        const to = path.join(dest, entry.name);
        if(entry.isDirectory())
            copyDir(from, to);
        else
            fs.copyFileSync(from, to);
    }
}

const root = path.join(__dirname, "..");
const dist = path.join(root, "dist");
if(!fs.existsSync(dist))
{
    console.error("dist/ missing — run pkg first");
    process.exit(1);
}

copyDir(path.join(root, "public"), path.join(dist, "public"));
console.log("Copied public/ → dist/public/");
