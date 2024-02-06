const controller = require("./controller");

class djcontrollerstarlight extends controller {
    constructor(conname, mapfilename, masteremit) {
        super(conname, mapfilename, masteremit);
    }

    handle(msg)
    {
        if(this.isOnIgnoreList(msg))
            return;

        //console.log(msg);
        //return;

        let res = -1;
        let id = msg.channel+"|"+msg.controller;

        if(msg._type == "noteon")
            id = msg.channel+"|"+msg.note;

        res = this.Elements.findIndex((elm) => elm.Id == id && elm.MsgType == msg._type);        
        Object.assign(this.OldCalledElement, this.CurrentCalledElement);

        if(res > -1 && msg._type == this.Elements[res].MsgType)
        {
            if(this.Elements[res].Type=="Btn")
            {
                if(msg.velocity == 127)
                {
                    this.Elements[res].toggleState();
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

    handleHardware(element)
    {
        if(element.Type=="Btn")
        {            
            let resultLed = {};

            resultLed.channel = element.Channel;
            resultLed.note = element.Controller;

            if(element.State == 1)
                resultLed.velocity = element.OnValue
            else
                resultLed.velocity = element.OffValue
            
            this.Output.send("noteon", resultLed);

            //console.log(element.Name);
            //emit to Master to call flexapi
        }
        // else
        // {
        //     //console.log(element.State);
        //     //emit to Masater ti cakk flexapi
        // }

        let trans = {};
        trans.Id = element.Id;
        trans.Type = element.Type;
        trans.Channel = element.Channel;
        trans.Controller = element.Controller;
        trans.MappedTo = element.MappedTo;
        trans.State = element.State;
        
        this.MasterEmitter.emit("ce", trans);

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