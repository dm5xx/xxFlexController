/**
 * Capture Terminal + Configs tabs using system Chrome/Edge (puppeteer-core).
 * Usage: node scripts/capture-editor-screens.js
 */
const path = require("path");
const fs = require("fs");
const puppeteer = require("puppeteer-core");

function findBrowser()
{
    if(process.env.PUPPETEER_EXECUTABLE_PATH && fs.existsSync(process.env.PUPPETEER_EXECUTABLE_PATH))
        return process.env.PUPPETEER_EXECUTABLE_PATH;
    const candidates = [
        process.env["ProgramFiles"] + "\\Google\\Chrome\\Application\\chrome.exe",
        process.env["ProgramFiles(x86)"] + "\\Google\\Chrome\\Application\\chrome.exe",
        process.env.LOCALAPPDATA + "\\Google\\Chrome\\Application\\chrome.exe",
        process.env["ProgramFiles"] + "\\Microsoft\\Edge\\Application\\msedge.exe",
        process.env["ProgramFiles(x86)"] + "\\Microsoft\\Edge\\Application\\msedge.exe"
    ];
    for(const c of candidates)
    {
        if(c && fs.existsSync(c))
            return c;
    }
    return null;
}

async function main()
{
    const root = path.join(__dirname, "..");
    process.chdir(root);

    const exe = findBrowser();
    if(!exe)
        throw new Error("Chrome/Edge not found");

    const port = 5567;
    const configeditor = require("../configeditor.js");
    const server = configeditor.start({
        port,
        openBrowser: false,
        fatal: false
    });
    if(!server)
        throw new Error("editor failed to start");

    const browser = await puppeteer.launch({
        executablePath: exe,
        headless: true,
        args: ["--no-sandbox", "--disable-setuid-sandbox"]
    });
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 820, deviceScaleFactor: 1 });
    await page.goto("http://127.0.0.1:" + port + "/", {
        waitUntil: "domcontentloaded",
        timeout: 20000
    });
    await page.waitForSelector("#tabBtnTerminal", { timeout: 10000 });
    await new Promise((r) => setTimeout(r, 1200));

    try
    {
        const hidden = await page.$eval("#infoOverlay", (el) => el.hidden).catch(() => true);
        if(!hidden)
        {
            await page.click("#infoOverlay");
            await new Promise((r) => setTimeout(r, 500));
        }
    }
    catch(e) {}

    await page.click("#tabBtnTerminal");
    await new Promise((r) => setTimeout(r, 500));
    const termPath = path.join(root, "public", "editor-terminal.PNG");
    await page.screenshot({ path: termPath });
    console.log("wrote", termPath);

    await page.click("#tabBtnConfigs");
    await new Promise((r) => setTimeout(r, 400));
    const buttons = await page.$$("#fileNav button");
    for(const b of buttons)
    {
        const t = await page.evaluate((el) => el.textContent || "", b);
        if(t.indexOf("config1") >= 0)
        {
            await b.click();
            break;
        }
    }
    await new Promise((r) => setTimeout(r, 700));
    const cfgPath = path.join(root, "public", "editor-configs.PNG");
    await page.screenshot({ path: cfgPath });
    console.log("wrote", cfgPath);

    await browser.close();
    await new Promise((resolve) => server.close(() => resolve()));
}

main().catch((err) =>
{
    console.error(err);
    process.exit(1);
});
