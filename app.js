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

var inConfigMode = false;

masterEmitter.on("ce", function (elm)
{
    try
    {
        if(!inConfigMode)
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
        xxFlex.fire("display panf s "+ xxFlex.DisplayPan.StreamId + " center="+freq);
});

masterEmitter.on("cptt", function (sli, sta)
{
    if(xxFlex["Slice"+sli].tx==0)
        xxFlex.fire("slice s "+sli+" tx=1");
    xxFlex.fire("xmit "+sta);
});


masterEmitter.on("def", function (freq, mod)
{
    xxFlex.fire("slice r 0");
    xxFlex.fire("slice r 1");
    xxFlex.fire("slice create frequ="+freq+" ant=ANT1 mode="+mod);
    xxFlex.fire("slice create frequ="+(freq+0.050) +" ant=ANT1 mode="+mod);
});

masterEmitter.on("con", function ()
{
    if(inConfigMode)
    {
        inConfigMode = false;
    }
    else
    {
        inConfigMode = true;
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
        inConfigMode = false;
        setTimeout(() => {controller.switchLedOff(elm.Id);},3000);
    }, 1000, elm, masterEmitter);

}
