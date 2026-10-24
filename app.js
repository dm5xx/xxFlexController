var Controller = null;

const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");

// Load JSON from process.cwd() so pkg EXE works with dist/public next to the binary
function loadConfigJson(relPath)
{
    const full = path.join(process.cwd(), relPath);
    return JSON.parse(fs.readFileSync(full, "utf8"));
}

/**
 * Re-spawn hidden and exit parent (Windows "no console / no taskbar" background).
 * Like a Linux daemon: no window to focus. Child sets HERCULES_BG=1 to avoid a loop.
 */
function daemonizeIfBackground(enabled)
{
    if(!enabled || process.env.HERCULES_BG === "1")
        return false;
    const child = spawn(process.execPath, process.argv.slice(1), {
        detached: true,
        stdio: "ignore",
        cwd: process.cwd(),
        env: Object.assign({}, process.env, { HERCULES_BG: "1" }),
        windowsHide: true
    });
    child.unref();
    process.exit(0);
    return true;
}

// Browser config UI (no MIDI / radio): node app.js --editor
if(process.argv.includes("--editor") || process.argv.includes("--edit-config"))
{
    let editorPort = 5555;
    let runInBackground = true;
    try
    {
        const g = loadConfigJson(path.join("public", "global.json"));
        if(g.JsonEditorPort != null && Number(g.JsonEditorPort) > 0)
            editorPort = Number(g.JsonEditorPort);
        if(g.RunInBackground !== undefined)
            runInBackground = !!g.RunInBackground;
    }
    catch(e) {}
    daemonizeIfBackground(runInBackground);
    require("./configeditor.js").start({
        port: editorPort,
        exitOnBrowserClose: runInBackground
    });
    return;
}

var configdir = "public";
const Global = loadConfigJson(path.join(configdir, "global.json"));

if(Global.JsonEditor === undefined)
    Global.JsonEditor = true;

if(Global.JsonEditorPort === undefined)
    Global.JsonEditorPort = 5555;

if(Global.Debug === undefined)
    Global.Debug = false;

if(Global.RunInBackground === undefined)
    Global.RunInBackground = true;

if(Global.OverlayText === undefined)
    Global.OverlayText = "Closing this browser tab will also close the Hercules app.";

if(Global.OverlayTime === undefined)
    Global.OverlayTime = 4;

daemonizeIfBackground(Global.RunInBackground);

// Capture console for browser terminal (before first log lines)
require("./consolebridge.js").install();

if(Global.publicdirnum !== undefined && Global.publicdirnum > 0)
    configdir = configdir+Global.publicdirnum;

var Config = loadConfigJson(path.join(configdir, "config"+Global.default+".json"));

if(Config.JogCoolDown === undefined)
    Config.JogCoolDown = 100;

const log = require("./logger.js");
log.setDebug(Global.Debug);

var defaults = loadConfigJson(path.join(configdir, "defaults.json")); //    "RitFreq" : [70,7]

if(defaults.RitFreq === undefined)
    defaults.RitFreq = [5000,1000];

const FlexDominator = require("./flexdominator.js");
const EventEmitter = require('node:events');
const xxFlexRadio = require("./xxflexradio.js");

if(Config.WindowsMidiName == "DJControl Starlight")
    Controller = require("./djcontrollerstarlight.js");
else {
    Controller = require("./djcontrollerstarlight.js"); // starlight will be default
}

const masterEmitter = new EventEmitter();
const flexDominator = new FlexDominator(masterEmitter, defaults);

var xxFlex = new xxFlexRadio(Config, defaults, masterEmitter);
var controller = new Controller(Config, masterEmitter, configdir);

Global.InConfigMode = false;
Global.Layer = 0;

log.info("Control your flex like hercules @Version " + "1.1.0RC1");
if(Global.Debug)
    log.info("Debug logging enabled");

if(Global.JsonEditor)
{
    require("./configeditor.js").start({
        fatal: false,
        port: Global.JsonEditorPort,
        exitOnBrowserClose: !!Global.RunInBackground
    });
    log.info("JSON config editor on http://127.0.0.1:"+Global.JsonEditorPort+"/ (JsonEditor)");
    if(Global.RunInBackground)
        log.info("RunInBackground: no console window; closing the browser tab will exit Hercules");
    else
        log.info("RunInBackground false: console visible; tab close does not exit the app");
}
else
    log.info("JSON config editor off (set JsonEditor true in public/global.json to enable)");

masterEmitter.on("ce", function (elm)
{
    try
    {
        if(!Global.InConfigMode)
        {
            if(flexDominator[elm.MappedTo]=== undefined)
                log.debug("Key "+elm.Id+" not mapped to function");
            else
                xxFlex.fire(flexDominator[elm.MappedTo](elm, xxFlex));
        }
        else
        {
            switch(elm.Id)
            {
                case "7|0":
                    switchToConfig(1, elm);
                    break;
                case "7|1":
                    switchToConfig(2, elm);
                    break;                
                case "7|2":
                    switchToConfig(3, elm);
                    break;
                
                case "7|3":
                    switchToConfig(4, elm);
                    break;

                case "7|16":
                    switchToConfig(5, elm);
                    break;

                case "7|17":
                    switchToConfig(6, elm);
                    break;
                    
                case "7|18":
                    switchToConfig(7, elm);
                    break;
                    
                case "7|19":
                    switchToConfig(8, elm);
                    break;
            }
        }
    }
    catch(error)
    {
        log.warn("Method not found");
        return;
    }

    // 3 is handled as a basefunctionality in djcontroller class
    if(elm.BtnTyp == 2)
    {
        setTimeout(() => controller.switchLedOff(elm.Id), 500);
    }
    else if(elm.BtnTyp == 4)
    {
        setTimeout(() => controller.setElementandLedOff(elm.Id), 500);
    }
});

masterEmitter.on("ct", function (freq)
{
        xxFlex.fire("display pan s "+ xxFlex.DisplayPan.StreamId + " center="+freq);
});

masterEmitter.on("cptt", function (sl, sli, sta)
{
    if(xxFlex["Slice"+sl].tx==0)
        xxFlex.fire("slice s "+sli+" tx=1");
    xxFlex.fire("xmit "+sta);
});


masterEmitter.on("def", function (freq, mod)
{
    xxFlex.fire("slice r "+xxFlex.SliceNumbs[0]);
    xxFlex.fire("slice r "+xxFlex.SliceNumbs[1]);
    xxFlex.SliceNumbs = [];

    xxFlex.fire("slice create freq="+(freq) +" ant=ANT1 mode="+mod);    
    xxFlex.fire("slice create freq="+(freq+0.005) +" ant=ANT1 mode="+mod);
    
    xxFlex.fire("slice t 0 "+(freq+0.001));    
    xxFlex.fire("slice t 1 "+(freq+0.006));
});

masterEmitter.on("con", function ()
{
    if(Global.InConfigMode)
    {
        Global.InConfigMode = false;
    }
    else
    {
        Global.InConfigMode = true;
        controller.switchLedPurple();
    }
});

masterEmitter.on("connected", function ()
{
    controller.switchLedGreen();
});

masterEmitter.on("error", function ()
{
    controller.switchLedRed();
});

masterEmitter.on("responseList", function (item)
{
    log.debug(item);
});

masterEmitter.on("tgl", function (elm)
{
    if(Global.Layer==0)
    {
        Global.Layer = 1;
        if(elm.State==0)
        {
            elm.State = 1;
            controller.switchLed(elm);            
        }
    }
    else
    {
        Global.Layer = 0;
        if(elm.State==1)
        {
            elm.State = 0;
            controller.switchLed(elm);            
        }
    }
    controller.setCurrentLayer(Global.Layer);
});

var wasSingle = false;

masterEmitter.on("fadeSO2R", function (flx, mode, a, b)
{
    if(mode < 2)
    {
        wasSingle = true;
        xxFlex.fire("audio client "+ flx.client_handle + " slice "+ a +" pan 50");
        xxFlex.fire("audio client "+ flx.client_handle + " slice "+ b +" pan 50");
    
        if(mode==0)
        {
    
            xxFlex.fire("audio client "+ flx.client_handle + " slice "+ a +" mute 0");
            xxFlex.fire("audio client "+ flx.client_handle + " slice "+ b +" mute 1");
            return;
        }
        else if(mode=1)
        {
            xxFlex.fire("audio client "+ flx.client_handle + " slice "+ a +" mute 1");
            xxFlex.fire("audio client "+ flx.client_handle + " slice "+ b +" mute 0");
            return;
        }    
    }
    else
    {
        if(wasSingle==true)
        {
            xxFlex.fire("audio client "+ flx.client_handle + " slice "+ a +" mute 0");
            xxFlex.fire("audio client "+ flx.client_handle + " slice "+ b +" mute 0");

            xxFlex.fire("audio client "+ flx.client_handle + " slice "+ a +" pan 0");
            xxFlex.fire("audio client "+ flx.client_handle + " slice "+ b +" pan 100");
            wasSingle =false;
        }
        return;
    }
});

masterEmitter.on("fadeSO2RMix", function (flx, mode, a, b)
{
    if(mode < 2)
    {
        wasSingle = true;
        xxFlex.fire("audio client "+ flx.client_handle + " slice "+ a +" pan 50");
        xxFlex.fire("audio client "+ flx.client_handle + " slice "+ b +" pan 50");
    
        if(mode==0)
        {
    
            xxFlex.fire("audio client "+ flx.client_handle + " slice "+ a +" mute 0");
            xxFlex.fire("audio client "+ flx.client_handle + " slice "+ b +" mute 1");
            return;
        }
        else if(mode=1)
        {
            xxFlex.fire("audio client "+ flx.client_handle + " slice "+ a +" mute 1");
            xxFlex.fire("audio client "+ flx.client_handle + " slice "+ b +" mute 0");
            return;
        }    
    }
    else
    {
        if(wasSingle==true)
        {
            xxFlex.fire("audio client "+ flx.client_handle + " slice "+ a +" mute 0");
            xxFlex.fire("audio client "+ flx.client_handle + " slice "+ b +" mute 0");

            xxFlex.fire("audio client "+ flx.client_handle + " slice "+ a +" pan 30");
            xxFlex.fire("audio client "+ flx.client_handle + " slice "+ b +" pan 70");

            wasSingle = false;
        }
        return;
    }
});

function switchToConfig(nr, elm)
{
    if(nr>Global.configs)
        return;

    log.info("Switching to config "+nr);

    xxFlex.disconnect();
    controller.closePorts();

    Config = loadConfigJson(path.join(configdir, "config"+nr+".json"));
    if(Config.JogCoolDown === undefined)
        Config.JogCoolDown = 100;

    log.info("I am controlling Flex @ "+Config.FlexIP+" now");
    
    setTimeout((elm, em) => {
        xxFlex = new xxFlexRadio(Config, defaults, em);
        controller = new Controller(Config, em, configdir);
        Global.InConfigMode = false;
        setTimeout(() => {
            controller.switchLedOff(elm.Id);
        },3000);
    }, 1000, elm, masterEmitter);

}
