var Controller = null;
const Config = require("./public/config.json");

const FlexDominator = require("./flexdominator.js");
const EventEmitter = require('node:events');
const xxFlexRadio = require("./xxflexradio.js");

if(Config.WindowsMidiName == "DJControl Starlight")
    Controller = require("./djcontrollerstarlight.js");

const masterEmitter = new EventEmitter();
const controller = new Controller(Config.WindowsMidiName, Config.MidimapFile, Config.FuncmapFile, masterEmitter);

const flexDominator = new FlexDominator();
const xxFlex = new xxFlexRadio(Config.FlexIP, Config.FlexPort);

var timeLock = false;

masterEmitter.on("ce", function (elm)
{
    // switch(elm.Type)
    // {
    //     case "Jog":
    //         if(!timeLock)
    //         {
    //             timeLock = true;
                //console.log("Fire for"+JSON.stringify(elm));
    //             setTimeout(() => timeLock = false, Config.JogCoolDown);
    //         };
    //         break;
    //     case "Btn":
    //     case "Poti":
    //         console.log("Fire for"+JSON.stringify(elm));
    //     break; 
    // }

    // if(!timeLock && elm.MappedTo!="")
    // {
        try
        {
            xxFlex.fire(flexDominator[elm.MappedTo](elm, xxFlex));
        }
        catch(error)
        {
            console.log("Method not found");
        }
    //}

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