var Controller = null;
const Config = require("./public/config.json");
const defaults = require("./public/defaults.json");

const FlexDominator = require("./flexdominator.js");
const EventEmitter = require('node:events');
const xxFlexRadio = require("./xxflexradio.js");

if(Config.WindowsMidiName == "DJControl Starlight")
    Controller = require("./djcontrollerstarlight.js");

const masterEmitter = new EventEmitter();
const controller = new Controller(Config.WindowsMidiName, Config.MidimapFile, masterEmitter);

const flexDominator = new FlexDominator(masterEmitter, defaults);
const xxFlex = new xxFlexRadio(Config.FlexIP, Config.FlexPort, defaults);

masterEmitter.on("ce", function (elm)
{
    try
    {
        xxFlex.fire(flexDominator[elm.MappedTo](elm, xxFlex));
    }
    catch(error)
    {
        console.log("Method not found");
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