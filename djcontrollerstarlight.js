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

        res = this.Elements.findIndex((elm) => (id.localeCompare(elm.Id) == 0 && elm.MsgType.localeCompare(msg._type) == 0));        
        Object.assign(this.OldCalledElement, this.CurrentCalledElement);

        if(res > -1 && msg._type == this.Elements[res].MsgType)
        {
            if(this.Elements[res].Type=="Btn")
            {
                if(msg.velocity == 127 && this.Elements[res].GrpId > 0)
                {
                    let grpMembers = this.Elements.filter(eli => eli.GrpId == this.Elements[res].GrpId);

                    grpMembers.forEach(element => {
                        if(element.Id != this.Elements[res].Id)
                        {
                            if(element.State == 1)
                            {
                                let gin = this.Elements.findIndex((elm) => elm.Id == element.Id);        

                                if(gin > -1)
                                {
                                    if(this.Elements[gin].State == 1)
                                    {
                                        this.Elements[gin].State = 0;
                                        this.handleHardware(this.Elements[gin]);
                                    }
                                }
                            }
                        }
                    });
                }
                if(this.Elements[res].BtnTyp != 3)
                {
                    if(msg.velocity == 127)
                    {
                        this.Elements[res].toggleState();
                        this.handleHardware(this.Elements[res]);
                    }    
                }
                else {
                    if(msg.velocity == 127)
                    {                        
                        this.Elements[res].OnState();
                    }
                    else
                    {
                        this.Elements[res].OffState();
                    }
                    this.handleHardware(this.Elements[res]);
                }
            }
            else
            {
                this.Elements[res].State = msg.value;

                if(this.Elements[res].Type== "Jog" || this.OldCalledElement.State !== this.Elements[res].State)
                    this.handleHardware(this.Elements[res]);
            }
            Object.assign(this.CurrentCalledElement, this.Elements[res]);
        }
    }


    setElementandLedOff(id)
    {
        res = this.Elements.findIndex((elm) => elm.Id == id);
        this.Elements[res].State = 0;
        this.handleHardware(this.Elements[res]);
    }

    switchLedOff(id)
    {
        for(let i=0; i < this.Elements.length; i++)
        {
            if(this.Elements[i].Id == id)
            {
                this.Elements[i].State = 0;
                this.switchLed(this.Elements[i]);
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
        let res = this.Elements.findIndex((elm) => elm.Id == id);        
        this.Elements[res].State = col;

        this.Output.send("noteon", {channel: this.Elements[res].Channel, note: this.Elements[res].Controller, velocity: this.Elements[res].State});
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