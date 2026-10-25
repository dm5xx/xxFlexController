let debugEnabled = false;
let consoleFilterInstalled = false;
const origConsoleLog = console.log.bind(console);

function isFlexLibraryNoise(args)
{
    if(!args || args.length === 0)
        return false;
    const s = String(args[0]);
    // flexradio-js always console.logs (their log_debug is also console.log)
    if(!/^Radio\[/.test(s) && !/^DiscoveryListener::/.test(s))
        return false;
    // Always drop high-volume command dumps; other Radio lines only when Debug is on
    if(/\._(sendRequest|receiveMessage)\(/.test(s))
        return true;
    return !debugEnabled;
}

function installConsoleFilter()
{
    if(consoleFilterInstalled)
        return;
    consoleFilterInstalled = true;
    console.log = function()
    {
        if(isFlexLibraryNoise(arguments))
            return;
        return origConsoleLog.apply(console, arguments);
    };
}

function setDebug(enabled)
{
    debugEnabled = !!enabled;
    installConsoleFilter();
}

function info()
{
    installConsoleFilter();
    console.log.apply(console, arguments);
}

function debug()
{
    if(debugEnabled)
    {
        installConsoleFilter();
        origConsoleLog.apply(console, arguments);
    }
}

function warn()
{
    console.warn.apply(console, arguments);
}

function error()
{
    console.error.apply(console, arguments);
}

// Active as soon as logger is loaded (before setDebug)
installConsoleFilter();

module.exports = { setDebug, info, debug, warn, error };
