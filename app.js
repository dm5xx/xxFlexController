var Controller = null;

const Global = require("./public/global.json");
var Config = require("./public/config"+Global.default+".json");

const defaults = require("./public/defaults.json");

const FlexDominator = require("./flexdominator.js");
const EventEmitter = require('node:events');
const xxFlexRadio = require("./xxflexradio.js");

if(Config.WindowsMidiName == "DJControl Starlight")
    Controller = require("./djcontrollerstarlight.js");

const masterEmitter = new EventEmitter();
const flexDominator = new FlexDominator(masterEmitter, defaults);

var xxFlex = new xxFlexRadio(Config.FlexIP, Config.FlexPort, defaults, masterEmitter);
var controller = new Controller(Config.WindowsMidiName, Config.MidimapFile, masterEmitter);

Global.InConfigMode = false;
Global.Layer = 0;

masterEmitter.on("ce", function (elm)
{
    try
    {
        if(!Global.InConfigMode)
        {
            if(flexDominator[elm.MappedTo]=== undefined)
                console.log("Key "+elm.Id+" not mapped to function");
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
        console.log("Method not found");
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
    xxFlex.fire("slice r 0");
    xxFlex.fire("slice r 1");
    xxFlex.fire("slice create freq="+freq+" ant=ANT1 mode="+mod);
    xxFlex.fire("slice create freq="+(freq+0.050) +" ant=ANT1 mode="+mod);
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
    console.log(item);
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

function switchToConfig(nr, elm)
{
    if(nr>Global.configs)
        return;

    console.log("Switchign to config"+nr);

    xxFlex.disconnect();
    controller.closePorts();

    Config = require("./public/config"+nr+".json");

    setTimeout((elm, em) => {
        xxFlex = new xxFlexRadio(Config.FlexIP, Config.FlexPort, defaults, em);
        controller = new Controller(Config.WindowsMidiName, Config.MidimapFile, em);
        Global.InConfigMode = false;
        setTimeout(() => {controller.switchLedOff(elm.Id);},3000);
    }, 1000, elm, masterEmitter);

}
