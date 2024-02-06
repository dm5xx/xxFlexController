class deviceElement {
    constructor(nam="", typ ="", par="", ctype="", chan="", cont="", onv=127, offv=0, mapto = "") {
        this.Id = chan + "|" + cont;
        this.Part = par;
        this.Name = nam;
        this.Type = typ;
        this.MsgType = ctype;
        this.Channel = +chan;
        this.Controller = +cont;
        this.OnValue = +onv;
        this.OffValue = +offv;

        this.MappedTo = mapto;
        this.State = 0;
    }

    toggleState()
    {
        if(this.State == 0)
            this.State = 1;
        else
            this.State = 0;
    }
}

module.exports = deviceElement; 