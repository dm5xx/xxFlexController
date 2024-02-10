class deviceElement {
    constructor(par="", nam="", typ ="", ctype="", chan="", cont="", onv=127, offv=0, id = "", mapto = "", btnTyp=0, grpid=0) {
        this.Part = par;
        this.Name = nam;
        this.Type = typ;
        this.MsgType = ctype;
        this.Channel = +chan;
        this.Controller = +cont;
        this.OnValue = +onv;
        this.OffValue = +offv;

        this.Id = id;
        this.BtnTyp = +btnTyp;
        this.MappedTo = mapto;
        this.GrpId = +grpid;
        this.State = 0;
    }

    toggleState()
    {
        if(this.State == 0)
            this.State = 1;
        else
            this.State = 0;
    }

    OnState()
    {
            this.State = 1;
    }

    OffState()
    {
            this.State = 0;
    }
}

module.exports = deviceElement; 