const Controller = require("./djcontrollerstarlight.js");
const FlexDominator = require("./flexdominator.js");
const EventEmitter = require('node:events');
const xxFlexRadio = require("./xxflexradio.js");

const ip = "192.168.1.1";
const port = "4711";
const jogCoolDown = 100;

const masterEmitter = new EventEmitter();
const controller = new Controller("DJControl Starlight", "midimap.csv", "funcmap.csv", masterEmitter);

const flexDominator = new FlexDominator();
const xxFlex = new xxFlexRadio(ip, port, flexDominator);

var timeLock = false;

masterEmitter.on("ce", function (elm)
{
    switch(elm.Type)
    {
        case "Jog":
            if(!timeLock)
            {
                timeLock = true;
                console.log("Fire for"+JSON.stringify(elm));
                setTimeout(() => timeLock = false, jogCoolDown);
            };
            break;
        case "Btn":
        case "Poti":
            console.log("Fire for"+JSON.stringify(elm));
        break; 
    }

    if(!timeLock && elm.MappedTo!="")
    {
        try
        {
            xxFlex.FlexDominator[elm.MappedTo](elm);
        }
        catch(error)
        {
            console.log("Method not found");
        }
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

// const intervalID = setInterval(myCallback, 1000);

// let t =0;

// let colorArray =[
//     3, // Dunkelblau
//     20, // hellblau
//     93, // grün
//     72, // gelb
//     101, // orange
//     64, // rot
//     67, // violett
//     127 //weiss
// ]

// let colorNArray =[
//     "Dunkelblau",
//     "hellblau",
//     "grün",
//     "gelb",
//     "orange",
//     "rot",
//     "violett",
//     "weiss",
// ]


// function myCallback() {
//     if(t==8)
//         t=0;

//     controller.handelBaseColor("1|35", colorArray[t]);
//     controller.handelBaseColor("2|35", colorArray[t]);
//     console.log(colorNArray[t]);
//     t++;
// }


// var lines = require('fs').readFileSync("public/map.csv", 'utf-8').split('\r\n');
// var controllerElements = [];
// for(let a=0; a < lines.length; a++)
// {
//   let item = lines[a].split(";");
//   controllerElements.push(new deviceElement(item[1], item[2], item[0], item[3], item[4], item[5], item[6], item[7]));
// }


// padInput.on('message', (msg) => {
//   console.log(msg);

//   //padOutput.send("noteon", {channel: 1, note: 5, velocity: 127});
//   padOutput.send("noteon", {channel: 1, note: 35, velocity: 22});
// });

// {channel: 2, controller: 1, value: 124, _type: 'cc'}
// {channel: 6, note: 18, velocity: 0, _type: 'noteon'}
