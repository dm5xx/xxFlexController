const controller = require("./controller");

class djcontrollerstarlight extends controller {
    constructor(conname, mapfilename, masteremit) {
        super(conname, mapfilename, masteremit);
    }

    handle(msg)
    {
        if(this.isOnIgnoreList(msg))
            return;
        
        let res = -1;
        let id = msg.channel+"|"+msg.controller;

        if(msg._type == "noteon")
            id = msg.channel+"|"+msg.note;

        res = this[this.CurrentLayerName].findIndex((elm) => (id.localeCompare(elm.Id) == 0 && elm.MsgType.localeCompare(msg._type) == 0));        
        Object.assign(this.OldCalledElement, this.CurrentCalledElement);

        if(res > -1 && msg._type == this[this.CurrentLayerName][res].MsgType)
        {
            if(this[this.CurrentLayerName][res].Type=="Btn")
            {
                if(msg.velocity == 127 && this[this.CurrentLayerName][res].GrpId > 0)
                {
                    let grpMembers = this[this.CurrentLayerName].filter(eli => eli.GrpId == this[this.CurrentLayerName][res].GrpId);

                    grpMembers.forEach(element => {
                        if(element.Id != this[this.CurrentLayerName][res].Id)
                        {
                            if(element.State == 1)
                            {
                                let gin = this[this.CurrentLayerName].findIndex((elm) => elm.Id == element.Id);        

                                if(gin > -1)
                                {
                                    if(this[this.CurrentLayerName][gin].State == 1)
                                    {
                                        this[this.CurrentLayerName][gin].State = 0;
                                        this.handleHardware(this[this.CurrentLayerName][gin]);
                                    }
                                }
                            }
                        }
                    });
                }
                if(this[this.CurrentLayerName][res].BtnTyp != 3)
                {
                    if(msg.velocity == 127)
                    {
                        this[this.CurrentLayerName][res].toggleState();
                        this.handleHardware(this[this.CurrentLayerName][res]);
                    }    
                }
                else {
                    if(msg.velocity == 127)
                    {                        
                        this[this.CurrentLayerName][res].OnState();
                    }
                    else
                    {
                        this[this.CurrentLayerName][res].OffState();
                    }
                    this.handleHardware(this[this.CurrentLayerName][res]);
                }
            }
            else
            {
                this[this.CurrentLayerName][res].State = msg.value;

                if(this[this.CurrentLayerName][res].Type== "Jog" || this.OldCalledElement.State !== this[this.CurrentLayerName][res].State)
                    this.handleHardware(this[this.CurrentLayerName][res]);
            }
            Object.assign(this.CurrentCalledElement, this[this.CurrentLayerName][res]);
        }
    }


    setElementandLedOff(id)
    {
        res = this[this.CurrentLayerName].findIndex((elm) => elm.Id == id);
        this[this.CurrentLayerName][res].State = 0;
        this.handleHardware(this[this.CurrentLayerName][res]);
    }

    switchLedOff(id)
    {
        for(let i=0; i < this[this.CurrentLayerName].length; i++)
        {
            if(this[this.CurrentLayerName][i].Id == id)
            {
                this[this.CurrentLayerName][i].State = 0;
                this.switchLed(this[this.CurrentLayerName][i]);
                return
            }
        }

        console.log("Led not found");
    }

    switchLed(element)
    {
        let resultLed = {};

        resultLed.channel = element.Channel;
        resultLed.note = element.Controller;

        if(element.State == 1)
            resultLed.velocity = element.OnValue
        else
            resultLed.velocity = element.OffValue

        this.Output.send("noteon", resultLed);
    }

    switchLedRed()
    {
        this.handelBaseColor("1|35", 64);
        this.handelBaseColor("2|35", 64);
    }

    switchLedPurple()
    {
        this.handelBaseColor("1|35", 67);
        this.handelBaseColor("2|35", 67);
    }

    switchLedGreen()
    {
        this.handelBaseColor("1|35", 93);
        this.handelBaseColor("2|35", 93);
    }

    handleHardware(element)
    {
        if(element.Type=="Btn")
        {                        
            this.switchLed(element);
        }
        // else
        // {
        //     //console.log(element.State);
        //     //emit to Masater ti cakk flexapi
        // }

        // let trans = {};
        // trans.Id = element.Id;
        // trans.Type = element.Type;
        // trans.Channel = element.Channel;
        // trans.Controller = element.Controller;
        // trans.MappedTo = element.MappedTo;
        // trans.State = element.State;
        // trans.BtnTyp = element.BtnTyp;
        // trans.GrpId = element.GrpId;

        this.MasterEmitter.emit("ce", element);
    }

    handelBaseColor(id, col)
    {
        let res = this[this.CurrentLayerName].findIndex((elm) => elm.Id == id);        
        this[this.CurrentLayerName][res].State = col;

        this.Output.send("noteon", {channel: this[this.CurrentLayerName][res].Channel, note: this[this.CurrentLayerName][res].Controller, velocity: this[this.CurrentLayerName][res].State});
        // 3, // Dunkelblau
        // 20, // hellblau
        // 93, // grün
        // 72, // gelb
        // 101, // orange
        // 64, // rot
        // 67, // violett
        // 99, // rosa
        // 127 //weiss
    }

    isOnIgnoreList(msg)
    {
        if(msg._type=="cc") // ignore double sided values
        {
            let d = msg.channel+"|"+msg.controller;
            
            switch(d)
            {
                case "1|40":
                case "0|35":
                case "1|32":
                case "1|33":
                case "2|40":
                case "0|36":
                case "2|32":
                case "2|33":
                {
                    //console.log("Ignored "+msg);
                    return true;
                }
            }

        }

        return false;
    }
}

module.exports = djcontrollerstarlight; 