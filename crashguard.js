/**
 * Keep the console window open after fatal errors so the message is readable
 * (Windows double-click / pkg EXE otherwise closes immediately).
 */
let holding = false;

function formatErr(err)
{
    if(err == null)
        return String(err);
    if(typeof err === "string")
        return err;
    if(err.stack)
        return err.stack;
    return String(err.message || err);
}

function holdOpen(extraMessage)
{
    if(holding)
        return;
    holding = true;

    try
    {
        console.error("");
        console.error("=== Hercules: fatal error — console kept open ===");
        if(extraMessage)
            console.error(formatErr(extraMessage));
        console.error("Press Enter to close this window.");
    }
    catch(e) {}

    const keepAlive = setInterval(() => {}, 1 << 30);

    const finish = () =>
    {
        clearInterval(keepAlive);
        process.exit(1);
    };

    try
    {
        if(process.stdin && process.stdin.isTTY)
        {
            process.stdin.resume();
            process.stdin.setEncoding("utf8");
            process.stdin.once("data", finish);
            return;
        }
    }
    catch(e) {}

    // No TTY (some pkg launches): stay alive so the window is not dismissed
}

function install()
{
    process.on("uncaughtException", (err) =>
    {
        try { console.error("Uncaught exception:"); console.error(formatErr(err)); } catch(e) {}
        holdOpen();
    });

    process.on("unhandledRejection", (reason) =>
    {
        try { console.error("Unhandled promise rejection:"); console.error(formatErr(reason)); } catch(e) {}
        holdOpen();
    });
}

module.exports = { install, holdOpen, formatErr };
