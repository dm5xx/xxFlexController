let debugEnabled = false;

function setDebug(enabled)
{
    debugEnabled = !!enabled;
}

function info()
{
    console.log.apply(console, arguments);
}

function debug()
{
    if(debugEnabled)
        console.log.apply(console, arguments);
}

function warn()
{
    console.warn.apply(console, arguments);
}

function error()
{
    console.error.apply(console, arguments);
}

module.exports = { setDebug, info, debug, warn, error };
